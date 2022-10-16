import { getPrecision, getPriceMove } from "./Functions";
import { PriceMove, StableUSDCoin } from "./Types";

export class PricesHolder {
  static readonly PRICES_MAX_CAP = 10;
  protected p: number[];

  constructor() {
    this.p = new Array(PricesHolder.PRICES_MAX_CAP).fill(0);
  }

  /**
   * Keeps the latest measures of the price.
   */
  get prices(): number[] {
    return this.p;
  }

  set prices(prices: number[]) {
    const tempHolder = new PricesHolder();
    // Using a temporary PricesHolder to ensure that prices array is of exact length
    prices?.forEach((p) => tempHolder.pushPrice(p));
    this.p = tempHolder.p;
  }

  get currentPrice(): number {
    return this.p[this.p.length - 1];
  }

  get previousPrice(): number {
    return this.p[this.p.length - 2];
  }

  get precision(): number {
    let precision = 0;
    this.prices.forEach((price) => {
      const p = getPrecision(price);
      if (p > precision) {
        precision = p;
      }
    });
    return precision;
  }

  pushPrice(price: number): void {
    if (!this.p.length || this.p[0] === 0) {
      this.p = new Array(PricesHolder.PRICES_MAX_CAP).fill(price);
    } else {
      this.p.push(price);
      // remove old prices and keep only the last PriceMemoMaxCapacity
      this.p.splice(0, this.p.length - PricesHolder.PRICES_MAX_CAP);
    }
  }

  priceGoesUp(): boolean {
    return this.getPriceMove() >= PriceMove.UP;
  }

  priceGoesStrongUp(): boolean {
    return this.getPriceMove() >= PriceMove.STRONG_UP;
  }

  priceGoesDown(): boolean {
    return this.getPriceMove() <= PriceMove.DOWN;
  }

  priceGoesStrongDown(): boolean {
    return this.getPriceMove() <= PriceMove.STRONG_DOWN;
  }

  getPriceMove(): PriceMove {
    return getPriceMove(PricesHolder.PRICES_MAX_CAP, this.p);
  }

  getMinMax(): { min: number; max: number } {
    let min = Number.MAX_VALUE;
    let max = 0;
    this.p.forEach((p) => {
      if (p < min) {
        min = p;
      }
      if (p > max) {
        max = p;
      }
    });
    return { min, max };
  }
}

export type CoinName = string;

export interface PriceHoldersMap {
  [key: CoinName]: PricesHolder;
}

export interface IPriceProvider {
  get: (stableCoin: StableUSDCoin) => PriceHoldersMap;
}
