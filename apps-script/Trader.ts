import {TradeMemo, TradeMemoKey} from "./TradeMemo";
import {IExchange} from "./Binance";
import {Statistics} from "./Statistics";
import {Config, IStore} from "./Store";

export type PriceMemo = [number, number, number]

export class V2Trader implements Trader {
  private readonly store: IStore;
  private readonly config: Config;
  private readonly exchange: IExchange;
  private readonly stats: Statistics;
  private readonly prices: { [p: string]: number };

  constructor(store: IStore, exchange: IExchange, stats: Statistics) {
    this.store = store;
    this.config = store.getConfig();
    this.exchange = exchange
    this.stats = stats
    this.prices = exchange.getPrices()
  }

  buy(symbol: ExchangeSymbol, cost: number): TradeResult {

    let tradeResult = this.exchange.marketBuy(symbol, cost);

    if (tradeResult.fromExchange) {
      Log.alert(tradeResult.toString())
      const tradeMemo: TradeMemo = this.store.getTrades()[symbol.quantityAsset];
      tradeResult = tradeMemo ? tradeMemo.tradeResult.join(tradeResult) : tradeResult
      const stopLossPrice = tradeResult.price * (1 - this.config.LossLimit);
      const prices: PriceMemo = tradeMemo ? tradeMemo.prices : [tradeResult.price, tradeResult.price, tradeResult.price]
      this.store.setTrade(new TradeMemo(tradeResult, stopLossPrice, prices))
      Log.info(`${symbol} stopLossPrice saved: ${stopLossPrice}`)
    }

    return tradeResult
  }

  sell(symbol: ExchangeSymbol): TradeResult {
    const tradeMemo: TradeMemo = this.store.getTrades()[symbol.quantityAsset];
    if (tradeMemo) {
      tradeMemo.sell = true;
      this.store.setTrade(tradeMemo)
      return this.sellAndClose(tradeMemo)
    }
    return TradeResult.fromMsg(symbol, "Asset is not present")
  }

  tickerCheck(tradeMemo: TradeMemo): TradeResult {
    if (tradeMemo.sell) {
      return this.sellAndClose(tradeMemo)
    }

    const symbol = tradeMemo.tradeResult.symbol;
    const currentPrice = this.getPrice(symbol);

    if (currentPrice <= tradeMemo.stopLossPrice) {
      const stopLimitCrossed = tradeMemo.prices[2] > tradeMemo.stopLossPrice;
      if (stopLimitCrossed) {
        Log.alert(`Stop limit crossed: ${symbol} price '${currentPrice}' <= '${tradeMemo.stopLossPrice}'`)
      }
      if (!tradeMemo.hodl && this.store.getConfig().SellAtStopLimit) {
        return this.sellAndClose(tradeMemo)
      }
    }

    const takeProfitPrice = tradeMemo.tradeResult.price * (1 + this.config.TakeProfit);
    if (currentPrice >= takeProfitPrice) {
      const takeProfitCrossed = tradeMemo.prices[2] < takeProfitPrice;
      if (takeProfitCrossed) {
        Log.alert(`Take profit crossed: ${symbol} price '${currentPrice}' >= '${takeProfitPrice}'`)
      }
      if (!tradeMemo.hodl && this.store.getConfig().SellAtTakeProfit) {
        return this.sellAndClose(tradeMemo)
      }
    }

    tradeMemo.prices.shift()
    tradeMemo.prices.push(currentPrice)

    if (this.priceGoesUp(tradeMemo.prices)) {
      Log.info(`${symbol} price goes up`)
      // Using previous price to calculate new stop limit
      const newStopLimit = tradeMemo.prices[0] * (1 - this.config.LossLimit);
      tradeMemo.stopLossPrice = tradeMemo.stopLossPrice < newStopLimit ? newStopLimit : tradeMemo.stopLossPrice
    }

    tradeMemo.maxLoss = tradeMemo.tradeResult.paid * (tradeMemo.stopLossPrice / tradeMemo.tradeResult.price - 1)
    tradeMemo.maxProfit = (currentPrice * tradeMemo.tradeResult.quantity) - tradeMemo.tradeResult.paid
    this.store.setTrade(tradeMemo)

    Log.info(`${symbol} asset kept. Stop loss price: '${tradeMemo.stopLossPrice}'`)

    return TradeResult.fromMsg(symbol, "Keeping the asset.")
  }

  private getPrice(symbol: ExchangeSymbol): number {
    const price = this.prices[symbol.toString()];
    if (!price) {
      throw Error(`No symbol price: ${symbol}`)
    }
    Log.info(`Symbol price: ${symbol} = ${price}`)
    return price
  }

  private sellAndClose(memo: TradeMemo) {
    const tradeResult = this.exchange.marketSell(memo.tradeResult.symbol, memo.tradeResult.quantity);

    if (tradeResult.fromExchange) {
      const commission = this.getBNBCommissionCost(tradeResult.commission);
      Log.info(`Commission in ${this.config.PriceAsset}: ~${commission}`)
      tradeResult.profit = tradeResult.gained - memo.tradeResult.paid - commission;
      Log.alert(tradeResult.toString());
      this.stats.addProfit(tradeResult.profit)
    }

    Log.debug(`Deleting memo from store: ${memo.getKey().toString()}`)
    this.store.deleteTrade(memo)

    return tradeResult
  }

  private priceGoesUp(lastPrices: PriceMemo): boolean {
    return lastPrices.every((value, index) => index == 0 ? true : value > lastPrices[index - 1])
  }

  private getBNBCommissionCost(commission: number): number {
    const bnbPrice = this.prices["BNB" + this.config.PriceAsset];
    return bnbPrice ? commission * bnbPrice : 0;
  }

}
