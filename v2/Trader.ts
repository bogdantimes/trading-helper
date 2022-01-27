type TradeMemo = {
  tradeResult: TradeResult
  stopLossPrice: number
  prices: PriceMemo;
}

type PriceMemo = [number, number, number]

class V2Trader implements Trader, StopLossSeller {
  private readonly store: IStore;
  private readonly exchange: IExchange;
  private readonly lossLimit: number;

  constructor(store: IStore, exchange: IExchange) {
    this.lossLimit = +store.getOrSet("LossLimit", "0.03")
    this.store = store
    this.exchange = exchange
  }

  stopLoss(): TradeResult[] {
    const results: TradeResult[] = []
    this.store.getKeys().forEach(k => {
      const tradeMemo: TradeMemo = this.readTradeMemo(k);
      if (tradeMemo) {
        results.push(this.stopLossSell(tradeMemo.tradeResult.symbol))
      }
    })
    if (!results.length) {
      StopLossWatcher.stop()
      Log.info("StopLossWatcher stopped as there are no assets to watch.")
    }
    return results
  }

  buy(symbol: ExchangeSymbol, cost: number): TradeResult {
    const tradeMemo: TradeMemo = this.readTradeMemo(`trade/${symbol.quantityAsset}`);
    if (tradeMemo) {
      tradeMemo.tradeResult.msg = "Not buying. Asset is already tracked."
      tradeMemo.tradeResult.fromExchange = false
      return tradeMemo.tradeResult
    }

    const tradeResult = this.exchange.marketBuy(symbol, cost);

    if (tradeResult.fromExchange) {
      const stopLossPrice = tradeResult.price * (1 - this.lossLimit);
      const prices: PriceMemo = [tradeResult.price, 0, 0]
      this.saveTradeMemo(symbol, {tradeResult, stopLossPrice, prices})
      Log.info(`${symbol} stopLossPrice saved: ${stopLossPrice}`)

      // @ts-ignore
      // workaround: no-op function to not run the tasks on restart
      _runtimeCtx[AppScriptExecutor.INSTANCE_NAME] = () => {
      }

      StopLossWatcher.restart()
      Log.info(`StopLossWatcher restarted to watch ${symbol}`)
    }

    return tradeResult
  }

  sell(symbol: ExchangeSymbol): TradeResult {
    const tradeMemo: TradeMemo = this.readTradeMemo(`trade/${symbol.quantityAsset}`);
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    tradeMemo.stopLossPrice = Number.MAX_SAFE_INTEGER;
    this.saveTradeMemo(symbol, tradeMemo)
    this.store.dump()

    return this.sellAndClose(symbol, tradeMemo)
  }

  stopLossSell(symbol: ExchangeSymbol): TradeResult {

    const tradeMemo: TradeMemo = this.readTradeMemo(`trade/${symbol.quantityAsset}`);
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    const currentPrice = this.exchange.getPrice(symbol);

    if (currentPrice <= tradeMemo.stopLossPrice) {
      Log.info(`Selling ${symbol} as current price '${currentPrice}' <= stop loss price '${tradeMemo.stopLossPrice}'`)
      return this.sellAndClose(symbol, tradeMemo)
    }

    tradeMemo.prices.shift()
    tradeMemo.prices.push(currentPrice)

    if (this.priceGoesUp(tradeMemo.prices)) {
      Log.info("Price goes up")
      // Using previous price to calculate new stop limit
      const newStopLimit = tradeMemo.prices[1] * (1 - this.lossLimit);
      tradeMemo.stopLossPrice = tradeMemo.stopLossPrice < newStopLimit ? newStopLimit : tradeMemo.stopLossPrice
    } else {
      Log.info("Price fluctuates")
    }

    this.saveTradeMemo(symbol, tradeMemo)

    Log.info(`${symbol} asset kept. Stop loss price: '${tradeMemo.stopLossPrice}'`)

    return TradeResult.fromMsg(symbol, "Keeping the asset.")
  }

  private sellAndClose(symbol: ExchangeSymbol, memo: TradeMemo) {
    const tradeResult = this.exchange.marketSell(symbol, memo.tradeResult.quantity);

    if (tradeResult.fromExchange) {
      tradeResult.profit = tradeResult.gained - memo.tradeResult.paid
      tradeResult.msg = `Asset sold.`
      this.store.delete(`trade/${symbol.quantityAsset}`)
    }

    return tradeResult
  }

  private readTradeMemo(key: string): TradeMemo {
    const tradeMemoRaw = key.startsWith("trade/") ? this.store.get(key) : null;
    if (tradeMemoRaw) {
      const tradeMemo: TradeMemo = JSON.parse(tradeMemoRaw);
      tradeMemo.tradeResult = Object.assign(new TradeResult(), tradeMemo.tradeResult)
      tradeMemo.tradeResult.symbol = ExchangeSymbol.fromObject(tradeMemo.tradeResult.symbol)
      tradeMemo.prices = tradeMemo.prices || [0, 0, 0]
      return tradeMemo
    }
    return null
  }

  private saveTradeMemo(symbol: ExchangeSymbol, tradeMemo: TradeMemo) {
    this.store.set('trade/' + symbol.quantityAsset, JSON.stringify(tradeMemo))
  }

  private priceGoesUp(lastPrices: PriceMemo): boolean {
    return lastPrices.every((value, index) => index == 0 ? true : value > lastPrices[index - 1])
  }

}
