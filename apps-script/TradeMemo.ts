import {ExchangeSymbol, TradeResult} from "./TradeResult";

export enum TradeState {
  BUY = 'buy',
  BOUGHT = 'bought',
  SELL = 'sell',
  SOLD = 'sold'
}

const PriceMemoMaxCapacity = 10;
export type PriceMemo = [number, number, number]

export class TradeMemo {
  tradeResult: TradeResult
  /**
   * The price at which the asset should be sold automatically if {@link Config.SellAtStopLimit}
   * is true, and {@link TradeMemo.hodl} is false.
   */
  stopLimitPrice: number = 0
  /**
   * Keeps the latest measures of the asset price.
   */
  prices: PriceMemo = [0, 0, 0];
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

  constructor(tradeResult: TradeResult) {
    this.tradeResult = tradeResult;
  }

  static copy(obj: TradeMemo): TradeMemo {
    return Object.assign(new TradeMemo(null), JSON.parse(JSON.stringify(obj)))
  }

  static fromObject(obj: object): TradeMemo {
    const tradeMemo: TradeMemo = Object.assign(new TradeMemo(null), obj);
    tradeMemo.tradeResult = Object.assign(new TradeResult(null), tradeMemo.tradeResult)
    tradeMemo.tradeResult.symbol = ExchangeSymbol.fromObject(tradeMemo.tradeResult.symbol)
    tradeMemo.prices = tradeMemo.prices || [0, 0, 0]
    return tradeMemo
  }

  getCoinName(): string {
    return this.tradeResult.symbol.quantityAsset
  }

  get currentPrice(): number {
    return this.prices[this.prices.length - 1]
  }

  pushPrice(price: number): void {
    if (this.prices[0] === 0) {
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
    if (state === TradeState.SOLD) {
      // Assign an empty trade result for SOLD state.
      // Keep the last trade price and the current prices.
      const newTradeResult = new TradeResult(this.tradeResult.symbol, "Asset sold");
      newTradeResult.soldPrice = this.tradeResult.price;
      Object.assign(this, new TradeMemo(newTradeResult), {prices: this.prices});
    }
    this.state = state
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
    return (this.currentPrice * this.tradeResult.quantity) - this.tradeResult.paid
  }

  profitPercent(): number {
    return (this.profit() / this.tradeResult.paid) * 100
  }

  stopLimitLoss(): number {
    return this.tradeResult.paid * (this.stopLimitPrice / this.tradeResult.price - 1)
  }

  stopLimitLossPercent(): number {
    return (this.stopLimitLoss() / this.tradeResult.paid) * 100
  }

  soldPriceChangePercent(): number {
    return (this.currentPrice - this.tradeResult.price) / this.tradeResult.price * 100
  }

  lossLimitCrossedDown(): boolean {
    // all prices except the last one are greater than the stop limit price
    return this.currentPrice < this.stopLimitPrice && this.prices.slice(0, -1).every(price => price >= this.stopLimitPrice)
  }

  profitLimitCrossedUp(profitLimit: number): boolean {
    // all prices except the last one are lower the profit limit price
    const profitLimitPrice = this.tradeResult.price * (1 + profitLimit);
    return this.currentPrice > profitLimitPrice && this.prices.slice(0, -1).every(price => price <= profitLimitPrice)
  }

  priceGoesUp(lastN: number = 3): boolean {
    const tail = this.prices.slice(-lastN);
    if (tail.length < lastN) return false;
    // returns true if all prices in the tail are increasing
    return this.getGrowthIndex(tail) === tail.length - 1;
  }

  /**
   * Returns the number of consecutive prices that are increasing.
   * Looks back from the last price.
   * The result is negative if prices are decreasing.
   * @example [3, 2, 1] => -2
   * @example [2, 2, 1] => -1
   * @example [1, 2, 2] => 0
   * @example [2, 2, 3] => 1
   * @example [1, 2, 3] => 2
   * @param prices
   */
  getGrowthIndex(prices: number[]): number {
    let result = 0;
    for (let j = prices.length - 1; j > 0; j--) {
      if (prices[j] > prices[j - 1]) {
        result++;
      } else if (prices[j] < prices[j - 1]) {
        result--;
      }
    }
    return result;
  }
}
