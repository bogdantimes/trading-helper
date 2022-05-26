import { TradeResult } from "./TradeResult"
import { ExchangeSymbol, TradeState } from "./types"
import { PricesHolder } from "./PricesHolder"

export class TradeMemo extends PricesHolder {
  tradeResult: TradeResult
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
    super()
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
    super.pushPrice(price)
    this.maxObservedPrice = Math.max(this.maxObservedPrice, ...this.prices)
  }

  setState(state: TradeState): void {
    if (state === TradeState.SOLD) {
      // Assign an empty trade result for SOLD state.
      // Keep the last trade price and the current price only.
      const newState = TradeMemo.newManual(this.tradeResult.symbol)
      newState.tradeResult.soldPrice = this.tradeResult.soldPrice
      newState.pushPrice(this.currentPrice)
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
}
