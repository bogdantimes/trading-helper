import {IStore} from "./Store";
import {IExchange} from "./Binance";
import {CacheProxy} from "./CacheProxy";
import {Recommendation} from "./lib/types";

export interface IRecommender {
  getRecommendations(): Recommendation[]

  updateRecommendations(): void

  resetRecommendations(): void
}


export class DefaultRecommender implements IRecommender {
  private store: IStore;
  private exchange: IExchange;
  private readonly RECOMMENDED_MARKET_FRACTION = 0.05;

  constructor(store: IStore, exchange: IExchange) {
    this.store = store;
    this.exchange = exchange;
  }

  /**
   * Returns symbols that raised in price when 90% of the marked was going down.
   * Returns first ten recommended symbols if there are more than ten.
   * Sorted by recommendation score.
   */
  getRecommendations(): Recommendation[] {
    const memosJson = CacheProxy.get("RecommenderMemos");
    const memos: { [key: string]: Recommendation } = memosJson ? JSON.parse(memosJson) : {};
    return Object
      .values(memos)
      .filter(memo => Recommendation.getRank(memo) > 0)
      .sort((a, b) => Recommendation.getRank(b) - Recommendation.getRank(a))
      .slice(0, 10);
  }

  updateRecommendations(): void {
    const prices = this.exchange.getPrices();
    const memosJson = CacheProxy.get("RecommenderMemos");
    const memos: { [key: string]: Recommendation } = memosJson ? JSON.parse(memosJson) : {};
    const priceAsset = this.store.getConfig().PriceAsset;
    const otherCoins: { [key: string]: Recommendation } = {};
    const coinsThatGoUp: { [key: string]: Recommendation } = {};
    const newMemos: { [key: string]: Recommendation } = {};
    Object.keys(prices).forEach(symbolString => {
      if (symbolString.endsWith(priceAsset) && !symbolString.includes("DOWN")) {
        const coinName = symbolString.split(priceAsset)[0];
        if (coinName) {
          const price = prices[symbolString];
          const memo = Object.assign(new Recommendation(coinName), memos[symbolString]);
          memo.pushPrice(price)
          newMemos[symbolString] = memo;

          const bucket = memo.priceGoesUp() ? coinsThatGoUp : otherCoins;
          bucket[symbolString] = memo;
        }
      }
    })

    // percent of prices that went down
    const goUpPercent = (Object.keys(coinsThatGoUp).length / Object.keys(prices).length) * 100;
    Log.info(`${(goUpPercent).toFixed(2)}% of prices went up`);

    // if only RECOMMENDED_MARKET_FRACTION% of coins go up, we update their recommendation rank
    const marketMostlyDown = Object.keys(coinsThatGoUp).length <= (this.RECOMMENDED_MARKET_FRACTION * Object.keys(prices).length);
    if (marketMostlyDown && Object.keys(coinsThatGoUp).length > 0) {
      Log.info(`${goUpPercent.toFixed(2)}% of market went up, updating recommendations`);
      Object.keys(coinsThatGoUp).forEach(symbolString => Recommendation.incrementRank(coinsThatGoUp[symbolString]))
    }

    CacheProxy.put("RecommenderMemos", JSON.stringify(newMemos));
  }

  resetRecommendations(): void {
    // todo: make concurrent safe
    CacheProxy.put("RecommenderMemos", JSON.stringify({}));
  }
}
