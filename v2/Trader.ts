type TradeMemo = {
  tradeResult: TradeResult
  stopLossPrice: number
}

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
        results.push(this.sell(tradeMemo.tradeResult.symbol))
      }
    })
    return results
  }

  buy(symbol: ExchangeSymbol, quantity: number): TradeResult {
    const tradeResult = this.exchange.marketBuy(symbol, quantity);

    if (tradeResult.fromExchange) {
      this.saveTradeMemo(symbol, {
        tradeResult: tradeResult,
        stopLossPrice: tradeResult.price * (1 - this.lossLimit)
      })
    }

    return tradeResult
  }

  sell(symbol: ExchangeSymbol): TradeResult {

    const tradeMemo: TradeMemo = this.readTradeMemo(`trade/${symbol.quantityAsset}`);
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    const currentPrice = this.exchange.getPrice(symbol);

    if (currentPrice <= tradeMemo.stopLossPrice) {
      Log.info(`Selling as current price '${currentPrice}' <= stop loss price '${tradeMemo.stopLossPrice}'`)
      const tradeResult = this.exchange.marketSell(symbol);

      if (tradeResult.fromExchange) {
        tradeResult.profit = tradeResult.cost - tradeMemo.tradeResult.cost
        tradeResult.msg = `Asset sold.`
        this.store.delete(`trade/${symbol.quantityAsset}`)
      }

      return tradeResult
    }

    tradeMemo.stopLossPrice = currentPrice * (1 - this.lossLimit)

    this.saveTradeMemo(symbol, tradeMemo)

    Log.info(`Asset kept. Updated stop loss price: '${tradeMemo.stopLossPrice}'`)

    return TradeResult.fromMsg(symbol, "Asset kept.")
  }

  private readTradeMemo(key: string): TradeMemo {
    const tradeMemoRaw = key.startsWith("trade/") ? this.store.get(key) : null;
    if (tradeMemoRaw) {
      const tradeMemo: TradeMemo = JSON.parse(tradeMemoRaw);
      tradeMemo.tradeResult = Object.assign(new TradeResult(), tradeMemo.tradeResult)
      tradeMemo.tradeResult.symbol = ExchangeSymbol.fromObject(tradeMemo.tradeResult.symbol)
      return tradeMemo
    }
    return null
  }

  private saveTradeMemo(symbol: ExchangeSymbol, tradeMemo: TradeMemo) {
    this.store.set('trade/' + symbol.quantityAsset, JSON.stringify(tradeMemo))
  }

}
