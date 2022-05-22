export enum StableUSDCoin {
  USDT = `USDT`,
  USDC = `USDC`,
  BUSD = `BUSD`,
}

export class CoinScore {
  static readonly PRICES_MAX_CAP = 5;
  /**
   * `r` is the number of times this memo was going up when the rest of the market wasn't.
   */
  private r = 0
  private p: number[] = []
  private readonly n: string

  /**
   * @deprecated
   */
  private readonly c: string

  constructor(coinName: string) {
    this.n = coinName
  }

  static new(coinName: string, obj?: CoinScore): CoinScore {
    const score = new CoinScore(coinName);
    score.p = obj?.p ?? score.p
    score.r = obj?.r ?? score.r
    return score
  }

  static fromObject(obj: CoinScore): CoinScore {
    const rec = new CoinScore(obj.n || obj.c)
    rec.r = obj.r
    rec.p = obj.p
    return rec
  }

  incrementScore() {
    this.r++
  }

  getScore(): number {
    return this.r
  }

  getCoinName(): string {
    return this.n
  }

  priceGoesUp(): boolean {
    if (this.p.length < CoinScore.PRICES_MAX_CAP) {
      return false
    }
    return this.p.every((p, i) => i == 0 ? true : p > this.p[i - 1])
  }

  pushPrice(price: number): void {
    this.p.push(price)
    if (this.p.length > CoinScore.PRICES_MAX_CAP) {
      this.p.splice(0, this.p.length - CoinScore.PRICES_MAX_CAP)
    }
  }

}

export type PriceMap = { [key: string]: number };

export class Coin {
  static isStable(coinName: string): boolean {
    return Object.keys(StableUSDCoin).includes(coinName.toUpperCase())
  }
}

export type Stats = {
  TotalProfit: number;
  DailyProfit: PriceMap;
}

export enum PriceProvider {
  Binance = `Binance`,
  CoinStats = `CoinStats`,
}

export class ExchangeSymbol {
  readonly quantityAsset: string
  readonly priceAsset: string

  constructor(quantityAsset: string, priceAsset: string) {
    if (!quantityAsset) {
      throw Error(`Invalid quantityAsset: "${quantityAsset}"`)
    }
    if (!priceAsset) {
      throw Error(`Invalid priceAsset: "${priceAsset}"`)
    }
    this.quantityAsset = quantityAsset.toUpperCase()
    this.priceAsset = priceAsset.toUpperCase()
  }

  static fromObject(object: { quantityAsset: string, priceAsset: string }): ExchangeSymbol {
    return new ExchangeSymbol(object.quantityAsset, object.priceAsset)
  }

  toString(): string {
    return this.quantityAsset + this.priceAsset
  }
}

export enum TradeState {
  BUY = `buy`,
  BOUGHT = `bought`,
  SELL = `sell`,
  SOLD = `sold`
}

export type PriceMemo = [number, number, number]
