type V1TradingOptions = {
  /**
   * The money coin to use for buying and selling.
   */
  moneyCoin: string
  /**
   * How much of money coin to use for the asset buying ($50 USDT by default).
   */
  buyQty: string
}

class V1Trader implements Trader {
  private options: V1TradingOptions;
  private store: IStore;
  private exchange: IExchange;

  constructor(store: IStore, exchange: IExchange) {
    this.options = {
      buyQty: store.getOrSet("BuyQty", "50"),
      moneyCoin: store.getOrSet("MoneyCoin", USDT)
    }
    this.store = store
    this.exchange = exchange
  }

  buy(assetName: string): TradeResult {
    if (!assetName) {
      throw Error(`Invalid asset name: "${assetName}"`)
    }
    return this.exchange.marketBuy(assetName, this.options.moneyCoin, this.options.buyQty)
  }

  sell(assetName: string): TradeResult {
    if (!assetName) {
      throw Error(`Invalid asset name: "${assetName}"`)
    }
    return this.exchange.marketSell(assetName, this.options.moneyCoin)
  }
}
