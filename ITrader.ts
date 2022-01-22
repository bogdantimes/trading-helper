interface Trader {
  buy(assetName: string): TradeResult

  sell(assetName: string): TradeResult
}

class TradeResult {
  assetName: string
  moneyCoin: string
  cost: number
  profit: number
  msg: string
  err: Error

  static fromMsg(assetName: string, moneyCoin: string, msg: string) {
    const result = new TradeResult();
    result.assetName = assetName
    result.moneyCoin = moneyCoin
    result.msg = msg
    return result
  }

  toString(): string {
    return this.err ?
      `${this.assetName}${this.moneyCoin} trade failed: ${this.err.message}` :
      `${this.assetName}${this.moneyCoin} trade result: price=${this.cost}, profit=${this.profit}, msg=${this.msg}`
  }
}
