interface Trader {
  buy(symbol: ExchangeSymbol, cost: number): TradeResult

  sell(symbol: ExchangeSymbol): TradeResult
}

interface StopLossSeller {
  stopLoss(): TradeResult[]
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

  static fromObject(object: { quantityAsset: string, priceAsset: string }): ExchangeSymbol {
    return new ExchangeSymbol(object.quantityAsset, object.priceAsset)
  }

  toString() {
    return this.quantityAsset + this.priceAsset
  }
}

class TradeResult {
  symbol: ExchangeSymbol
  quantity: number;
  cost: number
  paid: number;
  gained: number;
  price: number
  profit: number
  msg: string
  fromExchange: boolean;

  static fromMsg(symbol: ExchangeSymbol, msg: string) {
    const result = new TradeResult();
    result.symbol = symbol
    result.msg = msg
    return result
  }

  toString(): string {
    return `${this.symbol} trade result: ${this.price ? 'price=' + this.price : ''} ${this.paid ? 'paid=' + this.paid : ''} ${this.gained ? 'gained=' + this.gained : ''} ${this.profit ? 'profit=' + this.profit : ''} ${this.msg ? 'msg=' + this.msg : ''}`
  }
}
