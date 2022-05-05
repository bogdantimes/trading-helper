export class Recommendation {
  /**
   * `r` is the number of times this memo was going up when 90% of marked was going down
   */
  private r: number = 0
  private p: [number, number, number] = [0, 0, 0]
  private readonly n: string

  /**
   * @deprecated
   */
  private readonly c: string

  constructor(coinName: string) {
    this.n = coinName
  }

  static fromObject(obj: Recommendation): Recommendation {
    const rec = new Recommendation(obj.n || obj.c)
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
      this.p = [price, price, price];
    } else {
      this.p.shift()
      this.p.push(price)
    }
  }

}
