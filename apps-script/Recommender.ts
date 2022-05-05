import {IStore} from "./Store";
import {IExchange} from "./Binance";
import {CacheProxy} from "./CacheProxy";
import {Recommendation} from "./lib/types";

export interface IRecommender {
  getRecommends(): Recommendation[]

  updateRecommendations(): void

  resetRecommends(): void
}


export class DefaultRecommender implements IRecommender {
  private store: IStore;
  private exchange: IExchange;
  private readonly RECOMMENDED_MARKET_FRACTION = 0.005; // 0.5% (Binance has 2030 prices right now, 0.5% is ~10 coins)

  constructor(store: IStore, exchange: IExchange) {
    this.store = store;
    this.exchange = exchange;
  }

  /**
   * Returns symbols that raised in price when 90% of the marked was going down.
   * Returns first ten recommended symbols if there are more than ten.
   * Sorted by recommendation score.
   */
  getRecommends(): Recommendation[] {
    const memosJson = CacheProxy.get("RecommenderMemos");
    const memos: { [key: string]: Recommendation } = memosJson ? JSON.parse(memosJson) : {};
    return Object
      .values(memos)
      .filter(memo => Recommendation.getScore(memo) > 0)
      .sort((a, b) => Recommendation.getScore(b) - Recommendation.getScore(a))
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
    Object.keys(prices).forEach(s => {
      if (s.endsWith(priceAsset)) {
        const coinName = s.split(priceAsset)[0];
        if (coinName && !coinName.endsWith('UP') && !s.endsWith('DOWN')) {
          const price = prices[s];
          const memo = Object.assign(new Recommendation(coinName), memos[s]);
          memo.pushPrice(price)
          newMemos[s] = memo;

          const bucket = memo.priceGoesUp() ? coinsThatGoUp : otherCoins;
          bucket[s] = memo;
        }
      }
    })

    // percent of prices that went down
    const goUpPercent = (Object.keys(coinsThatGoUp).length / Object.keys(prices).length) * 100;
    Log.info(`${(goUpPercent).toFixed(2)}% of prices went up`);

    // if only RECOMMENDED_MARKET_FRACTION% of coins go up, we update their recommendation rank
    const marketMostlyDown = Object.keys(coinsThatGoUp).length <= (this.RECOMMENDED_MARKET_FRACTION * Object.keys(prices).length);
    if (marketMostlyDown && Object.keys(coinsThatGoUp).length > 0) {
      Object.values(coinsThatGoUp).forEach(Recommendation.incrementScore);
      Log.info(`Updated recommendations.`);
    }

    CacheProxy.put("RecommenderMemos", JSON.stringify(newMemos));
  }

  resetRecommends(): void {
    // todo: make concurrent safe
    CacheProxy.put("RecommenderMemos", JSON.stringify({}));
  }
}
