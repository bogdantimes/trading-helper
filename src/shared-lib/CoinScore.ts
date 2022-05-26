import { PricesHolder } from "./PricesHolder"

export class CoinScore extends PricesHolder {
  private readonly n: string
  private r = 0

  /**
   * @deprecated
   */
  private readonly c: string

  constructor(coinName: string, obj?: CoinScore) {
    super()
    this.n = coinName
    this.p = obj?.p ?? this.p
    this.r = obj?.r ?? this.r
  }

  static fromObject(obj: CoinScore): CoinScore {
    const rec = new CoinScore(obj.n || obj.c)
    rec.r = obj.r
    rec.p = obj.p
    return rec
  }

  /**
   * The number of times this coin was going up when the rest of the market wasn't.
   */
  get score(): number {
    return this.r
  }

  get coinName(): string {
    return this.n
  }

  scoreUp() {
    this.r++
  }

  scoreDown() {
    this.r > 0 && this.r--
  }
}
