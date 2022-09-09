import { TradeResult } from "./TradeResult";
import { ExchangeSymbol, TradeState } from "./Types";
import { PricesHolder } from "./IPriceProvider";

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
   * Maximum price ever observed for this asset.
   */
  private maxPrice = 0;
  /**
   * The current state of the asset.
   */
  private state: TradeState;

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

  get maxObservedPrice(): number {
    return this.maxPrice;
  }

  set maxObservedPrice(price: number) {
    this.maxPrice = Math.max(0, price);
  }

  get stopLimitPrice(): number {
    return this.stopLimit;
  }

  set stopLimitPrice(price: number) {
    this.stopLimit = Math.max(0, price);
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
      this.deleted = true;
    }
  }

  pushPrice(price: number): void {
    super.pushPrice(price);
    this.maxObservedPrice = Math.max(this.maxObservedPrice, ...this.prices);
  }

  setState(state: TradeState): void {
    if (state === TradeState.SOLD) {
      // Assign an empty trade result for SOLD state.
      // Keep the last trade price and the current price only.
      const newState = TradeMemo.newManual(this.tradeResult.symbol);
      newState.tradeResult.soldPrice = this.tradeResult.soldPrice;
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
    return (
      this.currentPrice * this.tradeResult.quantity - this.tradeResult.paid
    );
  }

  profitPercent(): number {
    return (this.profit() / this.tradeResult.paid) * 100;
  }

  stopLimitLoss(): number {
    return (
      this.tradeResult.paid * (this.stopLimitPrice / this.tradeResult.price - 1)
    );
  }

  stopLimitLossPercent(): number {
    return (this.stopLimitLoss() / this.tradeResult.paid) * 100;
  }

  soldPriceChangePercent(): number {
    return (
      ((this.currentPrice - this.tradeResult.soldPrice) /
        this.tradeResult.soldPrice) *
      100
    );
  }

  stopLimitCrossedDown(): boolean {
    return (
      this.currentPrice < this.stopLimitPrice &&
      this.prices[this.prices.length - 2] >= this.stopLimitPrice
    );
  }

  entryPriceCrossedUp(): boolean {
    // all prices except the last one are lower the price at which the trade was bought
    const entryPrice = this.tradeResult.price;
    return (
      this.currentPrice > entryPrice &&
      this.prices.slice(0, -1).every((p) => p <= entryPrice)
    );
  }
}
