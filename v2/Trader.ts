class V2Trader implements Trader {
  private readonly store: IStore;
  private readonly exchange: IExchange;
  private readonly lossLimit: number;

  constructor(store: IStore, exchange: IExchange) {
    this.lossLimit = +store.getOrSet("LossLimit", "0.03")
    this.store = store
    this.exchange = exchange
  }

  buy(symbol: ExchangeSymbol, quantity: number): TradeResult {
    const tradeResult = this.exchange.marketBuy(symbol, quantity);

    if (tradeResult.succeeded) {
      this.store.set(`${tradeResult.symbol}/bought`, tradeResult.cost.toString())
      this.store.set(`${tradeResult.symbol}/boughtAtPrice`, tradeResult.price.toString())
      this.store.set(`${tradeResult.symbol}/stopLossPrice`, (tradeResult.price * (1 - this.lossLimit)).toString())
    }

    return tradeResult
  }

  sell(symbol: ExchangeSymbol): TradeResult {

    if (!this.store.get(`${symbol}/bought`)) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    const currentPrice = this.exchange.getPrice(symbol);
    const stopLossPrice = this.getStopLossPrice(symbol);

    if (currentPrice <= stopLossPrice) {
      Log.info(`Selling as current price '${currentPrice}' <= stop loss price '${stopLossPrice}'`)
      const tradeResult = this.exchange.marketSell(symbol);

      if (tradeResult.succeeded) {
        const bought = +this.store.get(`${tradeResult.symbol}/bought`);
        tradeResult.profit = tradeResult.cost - bought
        tradeResult.msg = `Asset sold.`
      }

      this.store.delete(`${tradeResult.symbol}/bought`)
      this.store.delete(`${tradeResult.symbol}/boughtAtPrice`)
      this.store.delete(`${tradeResult.symbol}/stopLossPrice`)

      return tradeResult
    }

    return TradeResult.fromMsg(symbol,
      `Asset kept. Updated stop loss price: '${this.setStopLossPrice(symbol, currentPrice)}'`)
  }

  private setStopLossPrice(symbol: ExchangeSymbol, curPrice: number): number {
    const stopLossPrice = curPrice * (1 - this.lossLimit);
    this.store.set(`${symbol}/stopLossPrice`, stopLossPrice.toString())
    return stopLossPrice
  }

  private getStopLossPrice(symbol: ExchangeSymbol) {
    const stopLossPrice = this.store.get(`${symbol}/stopLossPrice`);
    return stopLossPrice ? +stopLossPrice : 0
  }
}
