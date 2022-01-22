class V1Trader implements Trader {
  private store: IStore;
  private exchange: IExchange;

  constructor(store: IStore, exchange: IExchange) {
    this.store = store
    this.exchange = exchange
  }

  buy(symbol: ExchangeSymbol, quantity: number): TradeResult {
    return this.exchange.marketBuy(symbol, quantity)
  }

  sell(symbol: ExchangeSymbol): TradeResult {
    return this.exchange.marketSell(symbol)
  }
}
