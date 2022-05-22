import { sumWithMaxPrecision } from './functions'
import { ExchangeSymbol } from './types'

export class TradeResult {
  symbol: ExchangeSymbol
  quantity: number = 0
  cost: number = 0
  paid: number = 0
  gained: number = 0
  soldPrice: number
  profit: number = 0
  commission: number = 0
  msg: string
  fromExchange: boolean = false;

  constructor(symbol: ExchangeSymbol, msg: string = '') {
    this.symbol = symbol
    this.msg = msg
  }

  get price(): number {
    return +(this.cost / this.quantity).toFixed(8);
  }

  set price(value: number) {
  }

  toString(): string {
    return `${this.symbol} => Qty: ${this.quantity}, Av. price: ${this.price}, Paid: ${this.paid}, Sold price: ${this.soldPrice}, Gained: ${this.gained}, Commission BNB: ${this.commission}, Profit: ${this.profit}, Msg: ${this.msg}`
  }

  /**
   * @example "Bought 21 DAR for 9.81183 BUSD. Average price: 0.46723"
   */
  toTradeString(): string {
    return `${this.soldPrice ? 'Sold' : 'Bought'} ${this.quantity} ${this.symbol.quantityAsset} for ${this.cost} ${this.symbol.priceAsset}. Price: ${this.price}`
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
