type PriceMemo = [number, number, number]

const blockedKey = (s: ExchangeSymbol) => `blocked/${s}`

class V2Trader implements Trader {
  private readonly store: IStore;
  private readonly exchange: IExchange;
  private readonly lossLimit: number;
  private readonly stats: Statistics;
  private readonly takeProfit: number;
  private prices: { [p: string]: number };

  constructor(store: IStore, exchange: IExchange, stats: Statistics) {
    this.lossLimit = +store.getOrSet("LossLimit", "0.03")
    this.takeProfit = +store.getOrSet("TakeProfit", "0.2")
    this.store = store
    this.exchange = exchange
    this.stats = stats
    Log.info("Fetching prices")
    this.prices = exchange.getPrices()
  }

  buy(symbol: ExchangeSymbol, cost: number): TradeResult {

    if (CacheService.getScriptCache().get(blockedKey(symbol))) {
      return TradeResult.fromMsg(symbol, "Symbol is blocked after reaching MaxLosses")
    }

    let tradeResult = this.exchange.marketBuy(symbol, cost);

    if (tradeResult.fromExchange) {
      const oldTradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
      if (oldTradeMemo) {
        tradeResult = oldTradeMemo.tradeResult.join(tradeResult)
      }
      const stopLossPrice = tradeResult.price * (1 - this.lossLimit);
      const prices: PriceMemo = [tradeResult.price, tradeResult.price, tradeResult.price]
      const tradeMemo = new TradeMemo(tradeResult, stopLossPrice, prices);
      this.saveTradeMemo(tradeMemo)
      Log.alert(tradeResult.toString())
      Log.info(`${symbol} stopLossPrice saved: ${stopLossPrice}`)
      MultiTradeWatcher.watch(tradeMemo)
    }

    return tradeResult
  }

  sell(symbol: ExchangeSymbol): TradeResult {
    let tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    if (tradeMemo.sell) {
      return this.sellAndClose(symbol, tradeMemo)
    }

    try {
      const price = tradeMemo.tradeResult.price;
      const currentPrice = this.getPrice(symbol);
      const takeProfitPrice = price * (1 + this.takeProfit)
      if ((currentPrice < takeProfitPrice) && (currentPrice > tradeMemo.stopLossPrice)) {
        return TradeResult.fromMsg(symbol, `Not selling as price below take profit: ${takeProfitPrice}`)
      }
    } catch (e) {
      Log.error(e)
    }

    // Double-checking the trade memo is still present because it could have been removed in parallel by stopLossSell
    tradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }
    tradeMemo.sell = true;
    this.saveTradeMemo(tradeMemo)

    return this.sellAndClose(symbol, tradeMemo)
  }

  stopLossSell(symbol: ExchangeSymbol): TradeResult {

    const tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    if (tradeMemo.sell) {
      return this.sellAndClose(symbol, tradeMemo)
    }

    const currentPrice = this.getPrice(symbol);

    if (currentPrice <= tradeMemo.stopLossPrice) {
      const stopLimitCrossed = tradeMemo.prices[2] > tradeMemo.stopLossPrice;
      if (stopLimitCrossed) {
        Log.alert(`Stop limit crossed: ${symbol} price '${currentPrice}' <= '${tradeMemo.stopLossPrice}'`)
      }
      if (DefaultStore.get("SellAtStopLimit")) {
        return this.sellAndClose(symbol, tradeMemo)
      }
    }

    const takeProfitPrice = tradeMemo.tradeResult.price * (1 + this.takeProfit)
    if (currentPrice >= takeProfitPrice) {
      const takeProfitCrossed = tradeMemo.prices[2] < takeProfitPrice;
      if (takeProfitCrossed) {
        Log.alert(`Take profit crossed: ${symbol} price '${currentPrice}' >= '${takeProfitPrice}'`)
      }
      if (DefaultStore.get("SellAtTakeProfit")) {
        return this.sellAndClose(symbol, tradeMemo)
      }
    }

    tradeMemo.prices.shift()
    tradeMemo.prices.push(currentPrice)

    if (this.priceGoesUp(tradeMemo.prices)) {
      Log.info(`${symbol} price goes up`)
      // Using previous price to calculate new stop limit
      const newStopLimit = tradeMemo.prices[1] * (1 - this.lossLimit);
      tradeMemo.stopLossPrice = tradeMemo.stopLossPrice < newStopLimit ? newStopLimit : tradeMemo.stopLossPrice
    }

    tradeMemo.maxLoss = tradeMemo.tradeResult.paid * (tradeMemo.stopLossPrice / tradeMemo.tradeResult.price - 1)
    tradeMemo.maxProfit = (currentPrice * tradeMemo.tradeResult.quantity) - tradeMemo.tradeResult.paid
    this.saveTradeMemo(tradeMemo)

    Log.info(`${symbol} asset kept. Stop loss price: '${tradeMemo.stopLossPrice}'`)

    return TradeResult.fromMsg(symbol, "Keeping the asset.")
  }

  private getPrice(symbol: ExchangeSymbol): number {
    const price = this.prices[symbol.toString()];
    if (!price) {
      throw Error(`No symbol price: ${symbol}`)
    }
    Log.info(`Symbol price: ${symbol} = ${price}`)
    return price
  }

  private sellAndClose(symbol: ExchangeSymbol, memo: TradeMemo) {
    const tradeResult = this.exchange.marketSell(symbol, memo.tradeResult.quantity);

    if (tradeResult.fromExchange) {
      tradeResult.profit = tradeResult.gained - memo.tradeResult.paid
      Log.alert(tradeResult.toString())
      if (tradeResult.profit > 0) {
        this.stats.bumpLossProfitMeter(symbol)
      } else {
        const lpMeter = this.stats.dumpLossProfitMeter(symbol);
        if (lpMeter <= 0) {
          const blockDurationMin = +this.store.getOrSet('BlockDurationMin', "240");
          CacheService.getScriptCache().put(blockedKey(symbol), "true", blockDurationMin * 60)
          Log.info(`${symbol} blocked for ${blockDurationMin} minutes as loss-profit meter reached 0.`)
        }
      }
    }

    Log.debug(`Deleting memo from store: ${memo.getKey().toString()}`)
    this.store.delete(memo.getKey().toString())
    MultiTradeWatcher.unwatch(memo)

    return tradeResult
  }

  private readTradeMemo(key: TradeMemoKey): TradeMemo {
    const tradeMemoRaw = this.store.get(key.toString());
    if (tradeMemoRaw) {
      return TradeMemo.fromObject(tradeMemoRaw)
    }
    return null
  }

  private saveTradeMemo(tradeMemo: TradeMemo) {
    this.store.set(tradeMemo.getKey().toString(), tradeMemo)
  }

  private priceGoesUp(lastPrices: PriceMemo): boolean {
    return lastPrices.every((value, index) => index == 0 ? true : value > lastPrices[index - 1])
  }

}
