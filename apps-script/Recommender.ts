import {IStore} from "./Store";
import {IExchange} from "./Binance";
import {CacheProxy} from "./CacheProxy";
import {CoinScore} from "./shared-lib/types";

export interface IRecommender {
  getScores(): CoinScore[]

  updateScores(): void

  resetScores(): void
}


export class SurvivorsRecommender implements IRecommender {
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
  getScores(): CoinScore[] {
    const memosJson = CacheProxy.get("RecommenderMemos");
    const memos: { [key: string]: CoinScore } = memosJson ? JSON.parse(memosJson) : {};
    const recommended: CoinScore[] = []
    Object.values(memos).forEach(m => {
      const r = CoinScore.fromObject(m);
      if (r.getScore() > 0) {
        recommended.push(r);
      }
    })
    return recommended.sort((a, b) => b.getScore() - a.getScore()).slice(0, 10);
  }

  updateScores(): void {
    const prices = this.exchange.getPrices();
    const scoresJson = CacheProxy.get("RecommenderMemos");
    const scores: { [key: string]: CoinScore } = scoresJson ? JSON.parse(scoresJson) : {};
    const priceAsset = this.store.getConfig().PriceAsset;
    const raisedCoins: { [key: string]: CoinScore } = {};
    const updatedScores: { [key: string]: CoinScore } = {};
    Object.keys(prices).forEach(s => {
      // skip symbols that have "UP" or "DOWN" in the middle of the string
      if (s.match(/^[A-Z]+(UP|DOWN)[A-Z]+$/)) {
        return;
      }
      const coinName = s.endsWith(priceAsset) ? s.split(priceAsset)[0] : null;
      if (coinName) {
        const price = prices[s];
        const score = CoinScore.new(coinName, scores[s]);
        score.pushPrice(price)
        score.priceGoesUp() && (raisedCoins[s] = score)
        updatedScores[s] = score;
      }
    })

    // percent of prices that went down
    const goUpPercent = (Object.keys(raisedCoins).length / Object.keys(prices).length) * 100;
    Log.info(`${(goUpPercent).toFixed(2)}% of market prices went up`);

    // if only MARKET_UP_FRACTION% of coins go up, we update their recommendation score
    const fractionMet = Object.keys(raisedCoins).length <= (this.MARKET_UP_FRACTION * Object.keys(prices).length);
    if (fractionMet && Object.keys(raisedCoins).length > 0) {
      Object.values(raisedCoins).forEach(r => r.incrementScore());
      Log.info(`Updated survivors.`);
    }

    CacheProxy.put("RecommenderMemos", JSON.stringify(updatedScores));
  }

  resetScores(): void {
    // todo: make concurrent safe
    CacheProxy.put("RecommenderMemos", JSON.stringify({}));
  }
}
