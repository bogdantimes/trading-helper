import { TradeResult } from "./TradeResult";
import { ExchangeSymbol, TradeState } from "./Types";
import { PricesHolder } from "./IPriceProvider";
import { type Signal } from "../gas/traders/plugin/api";
import { StandardCommission } from "./Config";

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
   * Lowest detected price for a trade.
   */
  lowestPrice = 0;
  /**
   * Highest detected price for a trade.
   */
  highestPrice = 0;
  /**
   * Target profit price.
   * @private
   */
  private target: number;
  /**
   * The current state of the asset.
   */
  private state: TradeState;

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

  setSignalMetadata(r: Signal): void {
    this.target = r.target;
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
      return (
        (1 - StandardCommission) * (this.currentPrice * qty) -
        this.tradeResult.paid
      );
    };
    return this.tradeResult.realisedProfit || unrealizedProfit();
  }

  /**
   * Returns the profit goal for the trade.
   */
  get profitGoalPrice(): number {
    return this.target;
  }

  get profitGoal(): number {
    return this.profitGoalPrice / this.tradeResult.entryPrice - 1;
  }

  profitPercent(): number {
    return (this.profit() / this.tradeResult.paid) * 100;
  }
}
