type V2TradingOptions = {
  /**
   * Sell the asset if price drops 5% (0.05) by default.
   */
  lossLimit: string
  /**
   * The money coin to use for buying and selling.
   */
  moneyCoin: string
  /**
   * How much of money coin to use for the asset buying ($50 USDT by default).
   */
  buyQty: string
}

class V2Trader implements Trader {
  private readonly options: V2TradingOptions;
  private readonly store: IStore;
  private exchange: IExchange;

  constructor(store: IStore, exchange: IExchange) {
    this.options = {
      buyQty: store.getOrSet("BuyQty", "50"),
      lossLimit: store.getOrSet("LossLimit", "0.03"),
      moneyCoin: store.getOrSet("MoneyCoin", USDT)
    }
    this.store = store
    this.exchange = exchange
  }

  buy(assetName: string): TradeResult {
    if (!assetName) {
      throw Error(`Invalid asset name: "${assetName}"`)
    }
    const tradeResult = this.exchange.marketBuy(assetName, this.options.moneyCoin, this.options.buyQty);
    if (tradeResult.cost > 0) {
      // TODO
    }
    return tradeResult
  }

  sell(assetName: string): TradeResult {
    if (!assetName) {
      throw Error(`Invalid asset name: "${assetName}"`)
    }
    return undefined;
  }
}
