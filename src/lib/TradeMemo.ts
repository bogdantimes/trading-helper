import { TradeResult } from "./TradeResult";
import { ExchangeSymbol, PriceMove, TradeState } from "./Types";
import { type Signal } from "../gas/traders/plugin/api";
import { StandardCommission } from "./Config";

export class TradeMemo {
  tradeResult: TradeResult;
  /**
   * TTL is within how many ticks (minutes) the trade must exceed 5% profit. Otherwise, it is automatically sold.
   */
  ttl = 0;
  /**
   * Marks the memo as one which has to be deleted.
   */
  deleted: boolean;
  /**
   * Lowest detected price for a trade.
   */
  lowestPrice = 0;
  /**
   * Highest detected price for a trade.
   */
  highestPrice = 0;
  /**
   * Current price support level.
   */
  _support: number;
  /**
   * Current price move for the past 10 minutes.
   */
  priceMove: PriceMove = PriceMove.NEUTRAL;

  state: TradeState;

  private curPrice = 0;
  /**
   * The current state of the asset.
   */

  private _lock: boolean;
  /**
   * Latest checked supply demand imbalance in the order book.
   * @private
   */
  private imb = 0;

  constructor(tradeResult: TradeResult) {
    this.tradeResult = tradeResult;
  }

  static copy(obj: TradeMemo): TradeMemo {
    return Object.assign(
      Object.create(TradeMemo.prototype),
      JSON.parse(JSON.stringify(obj))
    );
  }

  static newManual(symbol: ExchangeSymbol, quantity = 0, paid = 0): TradeMemo {
    const tm = new TradeMemo(new TradeResult(symbol));
    tm.setState(TradeState.BOUGHT);
    tm.tradeResult.fromExchange = true;
    tm.tradeResult.quantity = quantity;
    tm.tradeResult.paid = paid;
    tm.tradeResult.cost = paid;
    return tm;
  }

  static fromObject(obj: object): TradeMemo {
    const tradeMemo: TradeMemo = Object.assign(
      Object.create(TradeMemo.prototype),
      obj
    );
    tradeMemo.tradeResult = Object.assign(
      Object.create(TradeResult.prototype),
      tradeMemo.tradeResult
    );
    tradeMemo.tradeResult.symbol = ExchangeSymbol.fromObject(
      tradeMemo.tradeResult.symbol
    );
    return tradeMemo;
  }

  get locked(): boolean {
    return this._lock;
  }

  static lock(tm: TradeMemo): void {
    tm._lock = true;
  }

  static unlock(tm: TradeMemo): void {
    tm._lock = false;
  }

  static isLocked(tm: TradeMemo): boolean {
    return !!tm?._lock;
  }

  static isUnlocked(tm: TradeMemo): boolean {
    return !tm?._lock;
  }

  getPriceMove(): PriceMove {
    return this.priceMove;
  }

  get currentPrice(): number {
    return this.curPrice;
  }

  set currentPrice(price: number) {
    this.curPrice = price;
  }

  get currentValue(): number {
    return this.currentPrice * this.tradeResult.quantity;
  }

  get support(): number {
    return this._support || this.tradeResult.entryPrice * 0.9;
  }

  set support(value: number) {
    this._support = value;
  }

  setSignalMetadata(r: Signal): void {
    this._support = r.support;
  }

  getCoinName(): string {
    return this.tradeResult.symbol.quantityAsset;
  }

  resetState(): void {
    if (this.tradeResult.quantity) {
      this.setState(TradeState.BOUGHT);
    } else if (this.tradeResult.soldPrice) {
      this.setState(TradeState.SOLD);
    } else {
      this.setState(TradeState.NONE);
      this.deleted = true;
    }
  }

  setState(state: TradeState): void {
    if (state === TradeState.SOLD) {
      // Assign an empty trade result for SOLD state.
      // Keep the last trade details only.
      const newState = TradeMemo.newManual(this.tradeResult.symbol);
      newState.tradeResult.soldPrice = this.tradeResult.soldPrice;
      newState.tradeResult.paid = this.tradeResult.paid;
      newState.tradeResult.gained = this.tradeResult.gained;
      newState.curPrice = this.currentPrice;
      Object.assign(this, newState);
    }
    this.state = state;
  }

  stateIs(state: TradeState): boolean {
    return this.state === state;
  }

  joinWithNewTrade(tradeResult: TradeResult): void {
    if (this.tradeResult.fromExchange) {
      this.tradeResult = this.tradeResult.join(tradeResult);
    } else {
      this.tradeResult = tradeResult;
    }
  }

  profit(): number {
    const unrealizedProfit = (): number => {
      // using lot size quantity to calculate profit,
      // because if quantity has a fraction that is less than lot size,
      // that part will not be sold
      // hence here we're counting only the part that will be sold
      const qty = this.tradeResult.lotSizeQty || this.tradeResult.quantity;
      // anticipated sell commission percentage
      return (
        (1 - StandardCommission) * (this.currentPrice * qty) -
        this.tradeResult.paid
      );
    };
    return this.tradeResult.realisedProfit || unrealizedProfit();
  }

  profitPercent(): number {
    return (this.profit() / this.tradeResult.paid) * 100;
  }

  get supplyDemandImbalance(): number {
    return this.imb ?? 0;
  }

  set supplyDemandImbalance(imb: number) {
    this.imb = imb;
  }

  imbalanceThreshold(mul = 5): number {
    const p = this.profitPercent();
    let t = Math.abs(p * mul) / 100;
    if (this.ttl >= 2000) {
      t *= this.ttl / 2000;
    }
    return t;
  }
}
