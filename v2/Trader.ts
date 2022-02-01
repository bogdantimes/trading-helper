type PriceMemo = [number, number, number]

class V2Trader implements Trader {
  private readonly store: IStore;
  private readonly exchange: IExchange;
  private readonly lossLimit: number;

  constructor(store: IStore, exchange: IExchange) {
    this.lossLimit = +store.getOrSet("LossLimit", "0.03")
    this.store = store
    this.exchange = exchange
  }

  buy(symbol: ExchangeSymbol, cost: number): TradeResult {
    const tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol).toString());
    if (tradeMemo) {
      tradeMemo.tradeResult.msg = "Not buying. Asset is already tracked."
      tradeMemo.tradeResult.fromExchange = false
      return tradeMemo.tradeResult
    }

    const tradeResult = this.exchange.marketBuy(symbol, cost);

    if (tradeResult.fromExchange) {
      const stopLossPrice = tradeResult.price * (1 - this.lossLimit);
      const prices: PriceMemo = [tradeResult.price, tradeResult.price, tradeResult.price]
      const tradeMemo = new TradeMemo(tradeResult, stopLossPrice, prices);
      this.saveTradeMemo(tradeMemo)
      Log.info(`${symbol} stopLossPrice saved: ${stopLossPrice}`)
      MultiTradeWatcher.watch(tradeMemo)
    }

    return tradeResult
  }

  sell(symbol: ExchangeSymbol): TradeResult {
    let tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol).toString());
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    if (tradeMemo.sell) {
      return this.sellAndClose(symbol, tradeMemo)
    }

    try {
      const price = tradeMemo.tradeResult.price;
      const currentPrice = this.exchange.getPrice(symbol);
      const halfOfLossLimitAbovePrice = price * (1 + (this.lossLimit / 2));
      if ((currentPrice < halfOfLossLimitAbovePrice) && (currentPrice > tradeMemo.stopLossPrice)) {
        return TradeResult.fromMsg(symbol, "Not selling as price jitter is ignored.")
      }
    } catch (e) {
      Log.error(e)
    }

    // Double-checking the trade memo is still present because it could have been removed in parallel by stopLossSell
    tradeMemo = this.readTradeMemo(new TradeMemoKey(symbol).toString());
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }
    tradeMemo.sell = true;
    this.saveTradeMemo(tradeMemo)

    return this.sellAndClose(symbol, tradeMemo)
  }

  stopLossSell(symbol: ExchangeSymbol): TradeResult {

    const tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol).toString());
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    if (tradeMemo.sell) {
      return this.sellAndClose(symbol, tradeMemo)
    }

    const currentPrice = this.exchange.getPrice(symbol);

    if (currentPrice <= tradeMemo.stopLossPrice) {
      Log.info(`Selling ${symbol} as current price '${currentPrice}' <= stop loss price '${tradeMemo.stopLossPrice}'`)
      return this.sellAndClose(symbol, tradeMemo)
    }

    tradeMemo.prices.shift()
    tradeMemo.prices.push(currentPrice)

    if (this.priceGoesUp(tradeMemo.prices)) {
      Log.info(`${symbol} price goes up`)
      // Using latest price to calculate new stop limit
      const newStopLimit = tradeMemo.prices[2] * (1 - this.lossLimit);
      tradeMemo.stopLossPrice = tradeMemo.stopLossPrice < newStopLimit ? newStopLimit : tradeMemo.stopLossPrice
    }

    tradeMemo.profitEstimate = tradeMemo.tradeResult.paid * (tradeMemo.stopLossPrice / tradeMemo.tradeResult.price - 1)
    this.saveTradeMemo(tradeMemo)

    Log.info(`${symbol} asset kept. Stop loss price: '${tradeMemo.stopLossPrice}'`)

    return TradeResult.fromMsg(symbol, "Keeping the asset.")
  }

  private sellAndClose(symbol: ExchangeSymbol, memo: TradeMemo) {
    const tradeResult = this.exchange.marketSell(symbol, memo.tradeResult.quantity);

    if (tradeResult.fromExchange) {
      tradeResult.profit = tradeResult.gained - memo.tradeResult.paid
      tradeResult.msg = `Asset sold.`
    }

    Log.debug(`Deleting memo from store: ${memo.getKey()}`)
    this.store.delete(memo.getKey().toString())
    MultiTradeWatcher.unwatch(memo)

    return tradeResult
  }

  private readTradeMemo(key: string): TradeMemo {
    const tradeMemoRaw = TradeMemoKey.isKey(key) ? this.store.get(key) : null;
    if (tradeMemoRaw) {
      return TradeMemo.fromJSON(tradeMemoRaw)
    }
    return null
  }

  private saveTradeMemo(tradeMemo: TradeMemo) {
    this.store.set(`${tradeMemo.getKey()}`, JSON.stringify(tradeMemo))
  }

  private priceGoesUp(lastPrices: PriceMemo): boolean {
    return lastPrices.every((value, index) => index == 0 ? true : value > lastPrices[index - 1])
  }

}
