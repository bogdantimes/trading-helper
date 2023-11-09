import { TradeResult } from "./TradeResult";
import { ExchangeSymbol, PriceMove, TradeState } from "./Types";
import { type Signal, SignalType } from "../gas/traders/plugin/api";
import { StandardFee } from "./Config";
import { f2, floor, getPrecision } from "./Functions";

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

  private curPrice = 0;

  /**
   * The current state of the asset.
   */
  private state: TradeState;

  /**
   * Latest checked supply demand imbalance in the order book.
   * @private
   */
  private imb = 0;

  /**
   * Signal type to differentiate old/manual and auto trades.
   */
  private _sType: SignalType;

  constructor(tradeResult: TradeResult) {
    this.tradeResult = tradeResult;
  }

  static copy(obj: TradeMemo): TradeMemo {
    return Object.assign(
      Object.create(TradeMemo.prototype),
      JSON.parse(JSON.stringify(obj)),
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
      obj,
    );
    tradeMemo.tradeResult = Object.assign(
      Object.create(TradeResult.prototype),
      tradeMemo.tradeResult,
    );
    tradeMemo.tradeResult.symbol = ExchangeSymbol.fromObject(
      tradeMemo.tradeResult.symbol,
    );
    return tradeMemo;
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

  /**
   * Starting v4.2.0 - all automatic trades have the signal type.
   * If type is not set - considering it is either manual or old.
   */
  isAutoTrade(): boolean {
    return this._sType === SignalType.Buy;
  }

  setSignalMetadata(r: Signal): void {
    this._support = r.support;
    this._sType = r.type;
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
        (1 - StandardFee) * (this.currentPrice * qty) - this.tradeResult.paid
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
    // TODO: if the current price is near a strong level
    //  for example: 0.6980 (near 0.7) - the threshold should be higher
    //  as usually such levels have strong resistances
    return t;
  }
}

export function prettyPrintTradeMemo(tm: TradeMemo): string {
  const stableCoin = tm.tradeResult.symbol.priceAsset;
  const entryPrice = floor(
    tm.tradeResult.entryPrice,
    getPrecision(tm.currentPrice),
  );
  return `${tm.getCoinName()} | ${tm.currentPrice} | P/L ${f2(
    tm.profitPercent(),
  )}%
Entry Price: ${entryPrice} ${stableCoin}
Qty total/sellable: ${tm.tradeResult.quantity} / ${tm.tradeResult.lotSizeQty}
Paid: ${f2(tm.tradeResult.paid)} ${stableCoin}
Current: ${f2(tm.currentValue)} (${f2(tm.profit())}) ${stableCoin}
BNB fee: ${tm.tradeResult.commission}`;
}
