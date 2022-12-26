import { TradeResult } from "./TradeResult";
import { ExchangeSymbol, TradeState } from "./Types";
import { PricesHolder } from "./IPriceProvider";
import { DefaultDuration, DefaultRange } from "./Config";
import { Signal } from "../gas/traders/plugin/api";

export class TradeMemo extends PricesHolder {
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
   * The price at which the asset should be sold automatically if {@link SellAtStopLimit}
   * is true.
   */
  private stopLimit = 0;
  /**
   * The current state of the asset.
   */
  private state: TradeState;
  /**
   * X represents the distance on the X axis (time in minutes) that was used for this particular trade.
   * More detailed information is not available for the open source part of the project.
   * Some default value is required for trades that existed before the introduction of this feature.
   */
  private x: number;
  /**
   * Y represents the range on the Y axis (price) that was used for this particular trade.
   * More detailed information is not available for the open source part of the project.
   * Some default value is required for trades that existed before the introduction of this feature.
   */
  private y: number;

  private _lock: boolean;

  constructor(tradeResult: TradeResult) {
    super();
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
    tradeMemo.prices = tradeMemo.prices || [];
    return tradeMemo;
  }

  get locked(): boolean {
    return this._lock;
  }

  lock(): void {
    this._lock = true;
  }

  unlock(): void {
    this._lock = false;
  }

  get currentValue(): number {
    return this.currentPrice * this.tradeResult.quantity;
  }

  get stopLimitPrice(): number {
    return this.stopLimit;
  }

  set stopLimitPrice(price: number) {
    this.stopLimit = Math.max(0, price);
  }

  setRequestMetadata(r: Signal): void {
    this.x = r.duration;
    this.y = r.rangeSize;
  }

  get duration(): number {
    return this.x ?? DefaultDuration;
  }

  get range(): number {
    return this.y ?? DefaultRange;
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

  pushPrice(price: number): void {
    super.pushPrice(price);
  }

  setState(state: TradeState): void {
    if (state === TradeState.SOLD) {
      // Assign an empty trade result for SOLD state.
      // Keep the last trade details only.
      const newState = TradeMemo.newManual(this.tradeResult.symbol);
      newState.tradeResult.soldPrice = this.tradeResult.soldPrice;
      newState.tradeResult.paid = this.tradeResult.paid;
      newState.tradeResult.gained = this.tradeResult.gained;
      newState.pushPrice(this.currentPrice);
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

  getState(): TradeState {
    return this.state;
  }

  profit(): number {
    const unrealizedProfit = (): number => {
      // using lot size quantity to calculate profit,
      // because if quantity has a fraction that is less than lot size,
      // that part will not be sold
      // hence here we're counting only the part that will be sold
      const qty = this.tradeResult.lotSizeQty || this.tradeResult.quantity;
      // anticipated sell commission percentage
      const commission = 1.0001;
      return this.currentPrice * qty - this.tradeResult.paid * commission;
    };
    return this.tradeResult.realisedProfit || unrealizedProfit();
  }

  /**
   * Returns the profit goal for the trade, taking into account the duration and range.
   * Formula: price * (1 + ((duration / 2000) * range * 0.1))
   * @example
   * For a trade with duration 4000 and range 0.14, the profit goal is:
   * (4000 / 2000) * 0.14 * 0.1 = 0.028 (2.8%)
   * If price is 10, the profit goal price is 10 * (1 + 0.028) = 10.28
   */
  get profitGoalPrice(): number {
    return this.tradeResult.entryPrice * (1 + this.profitGoal);
  }

  get profitGoal(): number {
    return Math.min(15, Math.max(2, this.duration / 2000)) * this.range * 0.1;
  }

  get stopLimitBottomPrice(): number {
    return this.tradeResult.entryPrice * (1 - this.range);
  }

  profitPercent(): number {
    return (this.profit() / this.tradeResult.paid) * 100;
  }

  stopLimitCrossedDown(): boolean {
    return (
      this.currentPrice < this.stopLimitPrice &&
      this.prices[this.prices.length - 2] >= this.stopLimitPrice
    );
  }
}
