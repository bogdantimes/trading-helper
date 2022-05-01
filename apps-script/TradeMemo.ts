import {PriceMemo} from "./Trader";
import {ExchangeSymbol, TradeResult} from "./TradeResult";

export enum TradeState {
  BUY = 'buy',
  BOUGHT = 'bought',
  SELL = 'sell',
  SOLD = 'sold'
}

const PriceMemoMaxCapacity = 10;

export class TradeMemo {
  tradeResult: TradeResult
  stopLossPrice: number = 0
  prices: PriceMemo;
  /**
   * Marks the asset for holding even if price drops.
   */
  hodl: boolean = false;
  /**
   * Maximum price ever observed for this asset.
   */
  maxObservedPrice: number = 0;
  /**
   * The current state of the asset.
   */
  private state: TradeState;

  constructor(tradeResult: TradeResult, stopLossPrice?: number, prices?: PriceMemo) {
    this.tradeResult = tradeResult;
    this.stopLossPrice = stopLossPrice;
    this.prices = prices || [0, 0, 0];
  }

  static fromObject(obj: object): TradeMemo {
    const tradeMemo: TradeMemo = Object.assign(new TradeMemo(null), obj);
    tradeMemo.tradeResult = Object.assign(new TradeResult(null), tradeMemo.tradeResult)
    tradeMemo.tradeResult.symbol = ExchangeSymbol.fromObject(tradeMemo.tradeResult.symbol)
    tradeMemo.prices = tradeMemo.prices || [0, 0, 0]
    return tradeMemo
  }

  getKey(): TradeMemoKey {
    return new TradeMemoKey(this.tradeResult.symbol)
  }

  pushPrice(price: number): void {
    if (price[0] === 0) {
      // initial state, filling it with price
      this.prices = [price, price, price];
    } else {
      this.prices.push(price)
      // remove old prices and keep only the last PriceMemoMaxCapacity
      this.prices.splice(0, this.prices.length - PriceMemoMaxCapacity)
    }
    this.maxObservedPrice = Math.max(this.maxObservedPrice, ...this.prices)
  }

  setState(state: TradeState): void {
    this.state = state
    if (state === TradeState.SOLD) {
      this.stopLossPrice = 0
      this.maxObservedPrice = 0
      const priorPrice = this.tradeResult.price;
      this.tradeResult = new TradeResult(this.tradeResult.symbol, "Asset sold")
      this.tradeResult.price = priorPrice;
    }
  }

  stateIs(state: TradeState): boolean {
    return this.state === state
  }

  joinWithNewTrade(tradeResult: TradeResult): void {
    if (this.tradeResult.fromExchange) {
      this.tradeResult = this.tradeResult.join(tradeResult);
    } else {
      this.tradeResult = tradeResult;
    }
    this.setState(TradeState.BOUGHT);
  }

  getState(): TradeState {
    return this.state
  }

  profit(): number {
    return (this.prices[this.prices.length - 1] * this.tradeResult.quantity) - this.tradeResult.paid
  }

  profitPercent(): number {
    return (this.profit() / this.tradeResult.paid) * 100
  }

  stopLimitLoss(): number {
    return this.tradeResult.paid * (this.stopLossPrice / this.tradeResult.price - 1)
  }

  stopLimitLossPercent(): number {
    return (this.stopLimitLoss() / this.tradeResult.paid) * 100
  }
}

export class TradeMemoKey {
  readonly symbol: ExchangeSymbol

  constructor(symbol: ExchangeSymbol) {
    this.symbol = symbol;
  }

  toString(): string {
    return `trade/${this.symbol.quantityAsset}`
  }
}
