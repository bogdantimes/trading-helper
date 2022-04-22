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
    this.quantityAsset = quantityAsset.toUpperCase();
    this.priceAsset = priceAsset.toUpperCase();
  }

  toString(): string {
    return this.quantityAsset + this.priceAsset
  }

  static fromObject(object: { quantityAsset: string, priceAsset: string }): ExchangeSymbol {
    return new ExchangeSymbol(object.quantityAsset, object.priceAsset)
  }
}

class TradeResult {
  symbol: ExchangeSymbol
  quantity: number = 0;
  cost: number = 0;
  paid: number = 0;
  gained: number = 0;
  price: number = 0
  profit: number = 0
  commission: number = 0
  msg: string = ""
  fromExchange: boolean = false;

  constructor(symbol: ExchangeSymbol, msg?: string) {
    this.symbol = symbol
    this.msg = msg
  }

  static preciseAverage(a: TradeResult, b: TradeResult): number {
    const ave = (a.price * a.quantity + b.price * b.quantity) / (a.quantity + b.quantity);
    const precision = Math.max(getPrecision(a.price), getPrecision(b.price));
    return +ave.toFixed(precision)
  }

  toString(): string {
    return `${this.symbol}: ${this.msg ? this.msg : ''} => ${this.price ? 'price=' + this.price : ''} ${this.paid ? 'paid=' + this.paid : ''} ${this.gained ? 'gained=' + this.gained : ''} ${this.profit ? 'profit=' + this.profit : ''}`
  }

  join(next: TradeResult): TradeResult {
    if (this.fromExchange != next.fromExchange) {
      throw Error(`Cannot join trades where 'fromExchange' is not equal: ${next.toString()}`)
    }
    if (this.symbol.toString() != next.symbol.toString()) {
      throw Error(`Cannot join trades where 'symbol' is not equal: ${next.toString()}`)
    }
    const result = new TradeResult(this.symbol, next.msg);
    result.price = TradeResult.preciseAverage(this, next)
    result.commission = this.commission + next.commission
    result.fromExchange = next.fromExchange
    result.quantity = this.quantity + next.quantity
    result.cost = this.cost + next.cost
    result.paid = this.paid + next.paid
    return result
  }
}