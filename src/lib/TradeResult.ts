import { f8, sumWithMaxPrecision } from "./Functions";
import { type ExchangeSymbol } from "./Types";

export class TradeResult {
  symbol: ExchangeSymbol;
  quantity = 0;
  /**
   * lotSizeQty is the quantity that can actually be sold on Binance,
   * without getting LOT_SIZE error
   */
  lotSizeQty = 0;
  // todo: get rid of either paid or cost field
  cost = 0;
  paid = 0;
  gained = 0;
  soldPrice = 0;
  soldQty = 0;
  commission = 0;
  msg = ``;
  fromExchange = false;

  constructor(symbol: ExchangeSymbol, msg = ``) {
    this.symbol = symbol;
    this.msg = msg;
  }

  get avgPrice(): number {
    return this.cost / this.quantity || 0;
  }

  get entryPrice(): number {
    if (this.quantity > 0) {
      return this.cost / this.quantity;
    }
    // for sold assets
    // calculate approximate entry price from soldPrice and realisedProfit
    const profitPercent = this.realisedProfit / this.paid;
    return this.soldPrice / (1 + profitPercent) || 0;
  }

  get realisedProfit(): number {
    return this.soldPrice ? this.gained - this.paid : 0;
  }

  toString(): string {
    return `${this.symbol} => Qty: ${this.quantity}, Entry Price: ${f8(
      this.entryPrice,
    )}, Paid: ${this.paid}, Sold price: ${this.soldPrice}, Gained: ${
      this.gained
    }, Commission BNB: ${this.commission}, Profit: ${
      this.realisedProfit
    }, Msg: ${this.msg}`;
  }

  join(next: TradeResult): TradeResult {
    if (this.fromExchange !== next.fromExchange) {
      throw Error(
        `Cannot join trades where 'fromExchange' is not equal: ${next}`,
      );
    }
    if (this.symbol.quantityAsset !== next.symbol.quantityAsset) {
      throw Error(
        `Cannot join trades where 'quantityAsset' is not equal: current=${this.symbol.quantityAsset} next=${next.symbol.quantityAsset}`,
      );
    }
    const result = new TradeResult(next.symbol, next.msg);
    result.commission = this.commission + next.commission;
    result.fromExchange = next.fromExchange;
    result.addQuantity(this.quantity, this.cost);
    result.addQuantity(next.quantity, next.cost);
    return result;
  }

  getChunk(size: number): TradeResult {
    if (size <= 0 || size > 1) {
      throw new Error(`Chunk size must be a value between 0 and 1.`);
    }
    const chunkQty = this.quantity * size;
    if (chunkQty <= 0) {
      throw new Error(
        `The calculated quantity for ${this.symbol.quantityAsset} is too small.`,
      );
    }
    const chunk = new TradeResult(this.symbol);
    chunk.quantity = chunkQty;
    chunk.cost = this.cost * size;
    chunk.gained = this.gained * size;
    chunk.paid = this.paid * size;
    chunk.commission = this.commission * size;
    return chunk;
  }

  addQuantity(quantity: number, cost: number): void {
    // we should maintain the precision returned by Binance for quantity
    this.quantity = sumWithMaxPrecision(this.quantity, quantity);
    this.cost += cost;
    this.paid += cost;
    // Reset lotSizeQty to 0, so that it will be recalculated
    this.lotSizeQty = 0;
  }

  setQuantity(quantity: number): void {
    this.quantity = quantity;
    // Reset lotSizeQty to 0, so that it will be recalculated
    this.lotSizeQty = 0;
  }
}
