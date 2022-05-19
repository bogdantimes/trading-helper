export enum PriceProvider {
  Binance = "Binance",
  CoinStats = "CoinStats",
}

export class ExchangeSymbol {
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

export class TradeResult {
  symbol: ExchangeSymbol
  quantity: number = 0;
  cost: number = 0;
  paid: number = 0;
  gained: number = 0;
  soldPrice: number;
  profit: number = 0
  commission: number = 0
  msg: string = ""
  fromExchange: boolean = false;

  constructor(symbol: ExchangeSymbol, msg?: string) {
    this.symbol = symbol
    this.msg = msg
  }

  get price(): number {
    return this.cost / this.quantity;
  }

  set price(value: number) {
  }

  toString(): string {
    return `${this.symbol} => Qty: ${this.quantity}, Av. price: ${this.price}, Paid: ${this.paid}, Sold price: ${this.soldPrice}, Gained: ${this.gained}, Commission BNB: ${this.commission}, Profit: ${this.profit}, Msg: ${this.msg}`
  }

  join(next: TradeResult): TradeResult {
    if (this.fromExchange != next.fromExchange) {
      throw Error(`Cannot join trades where 'fromExchange' is not equal: ${next.toString()}`)
    }
    if (this.symbol.quantityAsset != next.symbol.quantityAsset) {
      throw Error(`Cannot join trades where 'quantityAsset' is not equal: current=${this.symbol.quantityAsset} next=${next.symbol.quantityAsset}`)
    }
    const result = new TradeResult(next.symbol, next.msg);
    result.commission = this.commission + next.commission
    result.fromExchange = next.fromExchange
    result.addQuantity(this.quantity, this.cost)
    result.addQuantity(next.quantity, next.cost)
    return result
  }

  addQuantity(quantity: number, cost: number): void {
    // we should maintain the precision returned by Binance for quantity
    this.quantity = sumWithMaxPrecision(this.quantity, quantity)
    this.cost += cost;
    this.paid += cost;
  }
}
