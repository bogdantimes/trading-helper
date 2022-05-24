import { TradeResult } from "./TradeResult"
import { ExchangeSymbol, PriceMemo, TradeState } from "./types"

export class TradeMemo {
  static readonly PriceMemoMaxCapacity = 10

  tradeResult: TradeResult
  /**
   * Keeps the latest measures of the asset price.
   */
  prices: PriceMemo = [0, 0, 0]
  /**
   * Marks the asset for holding even if price drops.
   */
  hodl = false
  /**
   * Marks the memo as one which has to be deleted.
   */
  deleted: boolean
  /**
   * The price at which the asset should be sold automatically if {@link Config.SellAtStopLimit}
   * is true, and {@link TradeMemo.hodl} is false.
   */
  private stopLimit = 0
  /**
   * Maximum price ever observed for this asset.
   */
  private maxPrice = 0
  /**
   * The current state of the asset.
   */
  private state: TradeState

  constructor(tradeResult: TradeResult) {
    this.tradeResult = tradeResult
  }

  static copy(obj: TradeMemo): TradeMemo {
    return Object.assign(new TradeMemo(null), JSON.parse(JSON.stringify(obj)))
  }

  static newManual(symbol: ExchangeSymbol, quantity = 0, paid = 0): TradeMemo {
    const tm = new TradeMemo(new TradeResult(symbol))
    tm.setState(TradeState.BOUGHT)
    tm.tradeResult.fromExchange = true
    tm.tradeResult.quantity = quantity
    tm.tradeResult.paid = paid
    tm.tradeResult.cost = paid
    return tm
  }

  static fromObject(obj: object): TradeMemo {
    const tradeMemo: TradeMemo = Object.assign(new TradeMemo(null), obj)
    tradeMemo.tradeResult = Object.assign(new TradeResult(null), tradeMemo.tradeResult)
    tradeMemo.tradeResult.symbol = ExchangeSymbol.fromObject(tradeMemo.tradeResult.symbol)
    tradeMemo.prices = tradeMemo.prices || [0, 0, 0]
    return tradeMemo
  }

  get currentPrice(): number {
    return this.prices[this.prices.length - 1]
  }

  get maxObservedPrice(): number {
    return this.maxPrice
  }

  set maxObservedPrice(price: number) {
    this.maxPrice = Math.max(0, price)
  }

  get stopLimitPrice(): number {
    return this.stopLimit
  }

  set stopLimitPrice(price: number) {
    this.stopLimit = Math.max(0, price)
  }

  getCoinName(): string {
    return this.tradeResult.symbol.quantityAsset
  }

  resetState(): void {
    if (this.tradeResult.quantity) {
      this.setState(TradeState.BOUGHT)
    } else if (this.tradeResult.soldPrice) {
      this.setState(TradeState.SOLD)
    } else {
      this.deleted = true
    }
  }

  pushPrice(price: number): void {
    if (!this.prices || !this.prices.length || this.prices[0] === 0) {
      // initial state, filling PriceMemoMaxCapacity with price
      this.prices = new Array(TradeMemo.PriceMemoMaxCapacity).fill(price) as PriceMemo
    } else {
      this.prices.push(price)
      // remove old prices and keep only the last PriceMemoMaxCapacity
      this.prices.splice(0, this.prices.length - TradeMemo.PriceMemoMaxCapacity)
    }
    this.maxObservedPrice = Math.max(this.maxObservedPrice, ...this.prices)
  }

  setState(state: TradeState): void {
    if (state === TradeState.SOLD) {
      // Assign an empty trade result for SOLD state.
      // Keep the last trade price and the current prices.
      const newState = TradeMemo.newManual(this.tradeResult.symbol)
      newState.tradeResult.soldPrice = this.tradeResult.soldPrice
      newState.prices = this.prices
      Object.assign(this, newState)
    }
    this.state = state
  }

  stateIs(state: TradeState): boolean {
    return this.state === state
  }

  joinWithNewTrade(tradeResult: TradeResult): void {
    if (this.tradeResult.fromExchange) {
      this.tradeResult = this.tradeResult.join(tradeResult)
    } else {
      this.tradeResult = tradeResult
    }
  }

  getState(): TradeState {
    return this.state
  }

  profit(): number {
    return this.currentPrice * this.tradeResult.quantity - this.tradeResult.paid
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
    return ((this.currentPrice - this.tradeResult.soldPrice) / this.tradeResult.soldPrice) * 100
  }

  lossLimitCrossedDown(): boolean {
    // all prices except the last one are greater than the stop limit price
    return (
      this.currentPrice < this.stopLimitPrice &&
      this.prices.slice(0, -1).every((p) => p >= this.stopLimitPrice)
    )
  }

  profitLimitCrossedUp(profitLimit: number): boolean {
    // all prices except the last one are lower the profit limit price
    const profitLimitPrice = this.tradeResult.price * (1 + profitLimit)
    return (
      this.currentPrice > profitLimitPrice &&
      this.prices.slice(0, -1).every((p) => p <= profitLimitPrice)
    )
  }

  entryPriceCrossedUp() {
    // all prices except the last one are lower the price at which the trade was bought
    const entryPrice = this.tradeResult.price
    return this.currentPrice > entryPrice && this.prices.slice(0, -1).every((p) => p <= entryPrice)
  }

  priceGoesUp(lastN = 3): boolean {
    const tail = this.prices.slice(-lastN)
    if (tail.length < lastN) return false
    // returns true if all prices in the tail are increasing
    return this.getPriceChangeIndex(tail) === tail.length - 1
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
  getPriceChangeIndex(prices: number[]): number {
    let result = 0
    for (let j = prices.length - 1; j > 0; j--) {
      if (prices[j] > prices[j - 1]) {
        result++
      } else if (prices[j] < prices[j - 1]) {
        result--
      }
    }
    return result
  }
}
