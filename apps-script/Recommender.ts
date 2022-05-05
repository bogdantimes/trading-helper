import {IStore} from "./Store";
import {IExchange} from "./Binance";
import {CacheProxy} from "./CacheProxy";
import {Survivor} from "./lib/types";

export interface IRecommender {
  getSurvivors(): Survivor[]

  updateSurvivors(): void

  resetSurvivors(): void
}


export class DefaultRecommender implements IRecommender {
  private store: IStore;
  private exchange: IExchange;
  private readonly MARKET_UP_FRACTION = 0.01; // 1% (Binance has 2030 prices right now, 1% is ~20 coins)

  constructor(store: IStore, exchange: IExchange) {
    this.store = store;
    this.exchange = exchange;
  }

  /**
   * Returns symbols that raised in price when most of the marked was going down.
   * Returns first ten recommended symbols if there are more than ten.
   * Sorted by recommendation score.
   */
  getSurvivors(): Survivor[] {
    const memosJson = CacheProxy.get("RecommenderMemos");
    const memos: { [key: string]: Survivor } = memosJson ? JSON.parse(memosJson) : {};
    const recommended: Survivor[] = []
    Object.values(memos).forEach(m => {
      const r = Survivor.fromObject(m);
      if (r.getScore() > 0) {
        recommended.push(r);
      }
    })
    return recommended.sort((a, b) => b.getScore() - a.getScore()).slice(0, 10);
  }

  updateSurvivors(): void {
    const prices = this.exchange.getPrices();
    const memosJson = CacheProxy.get("RecommenderMemos");
    const memos: { [key: string]: Survivor } = memosJson ? JSON.parse(memosJson) : {};
    const priceAsset = this.store.getConfig().PriceAsset;
    const coinsThatGoUp: { [key: string]: Survivor } = {};
    const updatedMemos: { [key: string]: Survivor } = {};
    Object.keys(prices).forEach(s => {
      // skip symbols that have "UP" or "DOWN" in the middle of the string
      if (s.match(/^[A-Z]+(UP|DOWN)[A-Z]+$/)) {
        return;
      }
      const coinName = s.endsWith(priceAsset) ? s.split(priceAsset)[0] : null;
      if (coinName) {
        const price = prices[s];
        const memo = memos[s] ? Survivor.fromObject(memos[s]) : new Survivor(coinName);
        memo.pushPrice(price)
        memo.priceGoesUp() && (coinsThatGoUp[s] = memo)
        updatedMemos[s] = memo;
      }
    })

    // percent of prices that went down
    const goUpPercent = (Object.keys(coinsThatGoUp).length / Object.keys(prices).length) * 100;
    Log.info(`${(goUpPercent).toFixed(2)}% of market prices went up`);

    // if only MARKET_UP_FRACTION% of coins go up, we update their recommendation score
    const fractionMet = Object.keys(coinsThatGoUp).length <= (this.MARKET_UP_FRACTION * Object.keys(prices).length);
    if (fractionMet && Object.keys(coinsThatGoUp).length > 0) {
      Object.values(coinsThatGoUp).forEach(r => r.incrementScore());
      Log.info(`Updated recommendations.`);
    }

    CacheProxy.put("RecommenderMemos", JSON.stringify(updatedMemos));
  }

  resetSurvivors(): void {
    // todo: make concurrent safe
    CacheProxy.put("RecommenderMemos", JSON.stringify({}));
  }
}
