export class Recommendation {
  /**
   * `r` is the number of times this memo was going up when 90% of marked was going down
   */
  private r: number = 0
  private p: [number, number, number] = [0, 0, 0]
  private readonly c: string

  constructor(symbol: string) {
    this.c = symbol
  }

  static incrementScore(r: Recommendation) {
    r.r++
  }

  static getScore(r: Recommendation): number {
    return r.r
  }

  static getSymbol(r: Recommendation): string {
    return r.c
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

  getCoinName(): string {
    return this.c
  }

  getRank(): number {
    return this.r
  }

}
