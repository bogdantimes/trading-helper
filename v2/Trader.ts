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

    if (tradeResult.succeeded) {
      this.store.set(`${tradeResult.symbol}/bought`, tradeResult.cost.toString())
      this.store.set(`${tradeResult.symbol}/boughtAtPrice`, tradeResult.price.toString())
      this.store.set(`${tradeResult.symbol}/stopLossPrice`, (tradeResult.price * (1 - +this.options.lossLimit)).toString())
    }

    return tradeResult
  }

  sell(assetName: string): TradeResult {
    if (!assetName) {
      throw Error(`Invalid asset name: "${assetName}"`)
    }

    if (!this.store.get(`${assetName}${this.options.moneyCoin}/bought`)) {
      return TradeResult.fromMsg(`${assetName}${this.options.moneyCoin}`, "Asset is not present")
    }

    const curPrice = this.exchange.getPrice(assetName, this.options.moneyCoin);
    const slPrice = this.getStopLossPrice(assetName);

    if (curPrice <= slPrice) {
      Log.info(`Selling as current price '${curPrice}' <= stop loss price '${slPrice}'`)
      const tradeResult = this.exchange.marketSell(assetName, this.options.moneyCoin);

      if (tradeResult.succeeded) {
        const bought = +this.store.get(`${tradeResult.symbol}/bought`);
        tradeResult.profit = tradeResult.cost - bought
        tradeResult.msg = `Asset sold.`
      }

      this.store.delete(`${tradeResult.symbol}/bought`)
      this.store.delete(`${tradeResult.symbol}/boughtAtPrice`)
      this.store.delete(`${tradeResult.symbol}/stopLossPrice`)

      return tradeResult
    }

    return TradeResult.fromMsg(`${assetName}${this.options.moneyCoin}`,
      `Asset kept. Updated stop loss price: '${this.setStopLossPrice(assetName, curPrice)}'`)
  }

  private setStopLossPrice(assetName: string, curPrice: number): number {
    const stopLossPrice = curPrice * (1 - +this.options.lossLimit);
    this.store.set(`${assetName}${this.options.moneyCoin}/stopLossPrice`, stopLossPrice.toString())
    return stopLossPrice
  }

  private getStopLossPrice(assetName: string) {
    const slPrice = this.store.get(`${assetName}${this.options.moneyCoin}/stopLossPrice`);
    return slPrice ? +slPrice : 0
  }
}
