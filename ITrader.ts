interface Trader {
  buy(symbol: ExchangeSymbol, quantity: number): TradeResult

  sell(symbol: ExchangeSymbol): TradeResult
}

class ExchangeSymbol {
  readonly quantityAsset: string
  readonly priceAsset: string

  constructor(quantityAsset: string, priceAsset: string) {
    if (!quantityAsset) {
      throw Error(`Invalid quantityAsset: "${quantityAsset}"`)
    }
    if (!priceAsset) {
      throw Error(`Invalid priceAsset: "${priceAsset}"`)
    }
    this.quantityAsset = quantityAsset;
    this.priceAsset = priceAsset;
  }

  toString() {
    return this.quantityAsset + this.priceAsset
  }
}

class TradeResult {
  symbol: ExchangeSymbol
  cost: number
  price: number;
  profit: number
  msg: string
  succeeded: boolean;

  static fromMsg(symbol: ExchangeSymbol, msg: string) {
    const result = new TradeResult();
    result.symbol = symbol
    result.msg = msg
    return result
  }

  toString(): string {
    return `${this.symbol} trade result: price=${this.price}, cost=${this.cost}, profit=${this.profit}, msg=${this.msg}`
  }
}
