import {PriceMemo} from "./Trader";

export class TradeMemo {
  tradeResult: TradeResult
  stopLossPrice: number = 0
  maxLoss: number = 0;
  maxProfit: number = 0;
  prices: PriceMemo;
  /**
   * Marks the asset for selling as soon as possible.
   */
  sell: boolean = false;
  /**
   * Marks the asset for holding even if price drops.
   */
  hodl: boolean = false;
  /**
   * Marks the asset for buying as soon as possible.
   */
  buy: boolean = false;
  /**
   * Marks the asset as sold.
   */
  sold: boolean = false;
  /**
   * Maximum price ever observed for this asset.
   */
  maxObservedPrice: number = 0;

  constructor(tradeResult: TradeResult, stopLossPrice: number, prices: PriceMemo) {
    this.tradeResult = tradeResult;
    this.stopLossPrice = stopLossPrice;
    this.prices = prices;
  }

  static empty(): TradeMemo {
    return new TradeMemo(null, 0, [0, 0, 0])
  }

  static memoToBuy(symbol: ExchangeSymbol): TradeMemo {
    const tradeMemo = this.empty();
    tradeMemo.buy = true
    tradeMemo.tradeResult = TradeResult.fromMsg(symbol, "New lazy buy");
    return tradeMemo;
  }

  static fromObject(obj: object): TradeMemo {
    const tradeMemo: TradeMemo = Object.assign(TradeMemo.empty(), obj);
    tradeMemo.tradeResult = Object.assign(new TradeResult(), tradeMemo.tradeResult)
    tradeMemo.tradeResult.symbol = ExchangeSymbol.fromObject(tradeMemo.tradeResult.symbol)
    tradeMemo.prices = tradeMemo.prices || [0, 0, 0]
    return tradeMemo
  }

  getKey(): TradeMemoKey {
    return new TradeMemoKey(this.tradeResult.symbol)
  }
}

export class TradeMemoKey {
  readonly symbol: ExchangeSymbol

  constructor(symbol: ExchangeSymbol) {
    this.symbol = symbol;
  }

  toString(): string {
    return `trade/${this.symbol.quantityAsset}`
  }
}
