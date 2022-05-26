import { getPriceMove } from "./functions"
import { PriceMove } from "./types"

export class PricesHolder {
  protected readonly PRICES_MAX_CAP = 10
  protected p: number[] = []

  /**
   * Keeps the latest measures of the price.
   */
  get prices() {
    return this.p
  }

  set prices(p: number[]) {
    this.p = p
  }

  get currentPrice(): number {
    return this.prices[this.prices.length - 1]
  }

  pushPrice(price: number): void {
    if (!this.prices.length || this.prices[0] === 0) {
      // initial state, filling PriceMemoMaxCapacity with price
      this.prices = new Array(this.PRICES_MAX_CAP).fill(price)
    } else {
      this.prices.push(price)
      // remove old prices and keep only the last PriceMemoMaxCapacity
      this.prices.splice(0, this.prices.length - this.PRICES_MAX_CAP)
    }
  }

  priceGoesUp(): boolean {
    return this.getPriceMove() >= PriceMove.UP
  }

  priceGoesUpStrong(): boolean {
    return this.getPriceMove() >= PriceMove.STRONG_UP
  }

  priceGoesDown(): boolean {
    return this.getPriceMove() <= PriceMove.DOWN
  }

  priceGoesDownStrong(): boolean {
    return this.getPriceMove() <= PriceMove.STRONG_DOWN
  }

  getPriceMove(): PriceMove {
    return getPriceMove(this.PRICES_MAX_CAP, this.prices)
  }
}
