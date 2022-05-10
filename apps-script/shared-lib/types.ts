type ScorePriceMemo = [number, number, number, number, number]

export class CoinScore {
  /**
   * `r` is the number of times this memo was going up when 90% of marked was going down
   */
  private r: number = 0
  private p: ScorePriceMemo = [0, 0, 0, 0, 0]
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
    if (this.p[0] == 0) {
      return false
    }
    return this.p.every((p, i) => i == 0 ? true : p > this.p[i - 1])
  }

  pushPrice(price: number): void {
    if (this.p[0] === 0) {
      // initial state, filling it with price
      this.p = [price, price, price, price, price]
    } else {
      this.p.shift()
      this.p.push(price)
    }
  }

}
