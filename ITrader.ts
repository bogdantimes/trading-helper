interface Trader {
  buy(assetName: string): TradeResult

  sell(assetName: string): TradeResult
}

class TradeResult {
  symbol: string
  cost: number
  price: number;
  profit: number
  msg: string
  succeeded: boolean;

  static fromMsg(symbol: string, msg: string) {
    const result = new TradeResult();
    result.symbol = symbol
    result.msg = msg
    return result
  }

  toString(): string {
    return `${this.symbol} trade result: price=${this.price}, cost=${this.cost}, profit=${this.profit}, msg=${this.msg}`
  }
}
