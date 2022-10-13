import { f2, f8, sumWithMaxPrecision } from "./Functions";
import { ExchangeSymbol } from "./Types";

export class TradeResult {
  symbol: ExchangeSymbol;
  quantity = 0;
  // todo: get rid of either paid or cost field
  cost = 0;
  paid = 0;
  gained = 0;
  soldPrice: number;
  profit = 0;
  commission = 0;
  msg: string;
  fromExchange = false;

  constructor(symbol: ExchangeSymbol, msg = ``) {
    this.symbol = symbol;
    this.msg = msg;
  }

  get price(): number {
    return f8(this.cost / this.quantity);
  }

  toString(): string {
    return `${this.symbol} => Qty: ${this.quantity}, Av. price: ${this.price}, Paid: ${this.paid}, Sold price: ${this.soldPrice}, Gained: ${this.gained}, Commission BNB: ${this.commission}, Profit: ${this.profit}, Msg: ${this.msg}`;
  }

  /**
   * @example "
   * Entry Date,Coin/Token,Invested,Quantity,Entry Price
   * 10/13/2022,WOO,94.99776,674.0253,0.1409
   * "
   *
   * @example "
   * Exit Date,Exit Price,Gained,% Profit/Loss
   * 10/13/2022,16.432,95.54,0.71
   * "
   */
  toCVSString(): string {
    const date = new Date().toLocaleDateString();
    if (this.soldPrice) {
      const profPercent = f2((this.profit / this.paid) * 100);
      return `Entry Date,Coin/Token,Invested,Quantity,Entry Price
${date},$${this.soldPrice},$${f2(this.gained)},${profPercent}%`;
    } else {
      const coin = this.symbol.quantityAsset;
      return `Exit Date,Exit Price,Gained,% Profit/Loss
${date},${coin},$${f2(this.paid)},${this.quantity},$${this.price}`;
    }
  }

  join(next: TradeResult): TradeResult {
    if (this.fromExchange !== next.fromExchange) {
      throw Error(
        `Cannot join trades where 'fromExchange' is not equal: ${next.toString()}`
      );
    }
    if (this.symbol.quantityAsset !== next.symbol.quantityAsset) {
      throw Error(
        `Cannot join trades where 'quantityAsset' is not equal: current=${this.symbol.quantityAsset} next=${next.symbol.quantityAsset}`
      );
    }
    const result = new TradeResult(next.symbol, next.msg);
    result.commission = this.commission + next.commission;
    result.fromExchange = next.fromExchange;
    result.addQuantity(this.quantity, this.cost);
    result.addQuantity(next.quantity, next.cost);
    return result;
  }

  addQuantity(quantity: number, cost: number): void {
    // we should maintain the precision returned by Binance for quantity
    this.quantity = sumWithMaxPrecision(this.quantity, quantity);
    this.cost += cost;
    this.paid += cost;
  }
}
