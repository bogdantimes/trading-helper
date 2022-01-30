class TradeMemo {
  tradeResult: TradeResult
  stopLossPrice: number
  profitEstimate: number = 0;
  prices: PriceMemo;
  sell: boolean;

  constructor(tradeResult: TradeResult, stopLossPrice: number, prices: PriceMemo) {
    this.tradeResult = tradeResult;
    this.stopLossPrice = stopLossPrice;
    this.prices = prices;
  }

  static empty(): TradeMemo {
    return new TradeMemo(null, 0, [0, 0, 0])
  }

  static fromJSON(json: string): TradeMemo {
    const tradeMemo: TradeMemo = Object.assign(TradeMemo.empty(), JSON.parse(json));
    tradeMemo.tradeResult = Object.assign(new TradeResult(), tradeMemo.tradeResult)
    tradeMemo.tradeResult.symbol = ExchangeSymbol.fromObject(tradeMemo.tradeResult.symbol)
    tradeMemo.prices = tradeMemo.prices || [0, 0, 0]
    return tradeMemo
  }

  getKey(): TradeMemoKey {
    return new TradeMemoKey(this.tradeResult.symbol)
  }
}

class TradeMemoKey {
  symbol: ExchangeSymbol

  constructor(symbol: ExchangeSymbol) {
    this.symbol = symbol;
  }

  toString(): string {
    return `trade/${this.symbol.quantityAsset}`
  }

  static isKey(key: string): boolean {
    return key.startsWith('trade/')
  }

  static from(key: string): TradeMemoKey {
    return new TradeMemoKey(new ExchangeSymbol(key.split("/")[1], USDT))
  }
}
