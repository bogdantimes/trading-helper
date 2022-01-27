class V1Trader implements Trader {
  private store: IStore;
  private exchange: IExchange;

  constructor(store: IStore, exchange: IExchange) {
    this.store = store
    this.exchange = exchange
  }

  buy(symbol: ExchangeSymbol, cost: number): TradeResult {
    return this.exchange.marketBuy(symbol, cost)
  }

  sell(symbol: ExchangeSymbol): TradeResult {
    return this.exchange.marketSell(symbol)
  }
}
