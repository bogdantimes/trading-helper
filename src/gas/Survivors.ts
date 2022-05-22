import { IStore } from './Store'
import { CacheProxy } from './CacheProxy'
import { CoinScore, StableUSDCoin } from '../shared-lib/types'
import { IExchange } from './Exchange'
import { Log } from './Common'

export interface ScoresManager {
  getScores(): CoinScore[]

  updateScores(): void

  resetScores(): void
}

type CoinScoreMap = { [key: string]: CoinScore };

export class Survivors implements ScoresManager {
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
    const scoresJson = CacheProxy.get('RecommenderMemos');
    const scores: CoinScoreMap = scoresJson ? JSON.parse(scoresJson) : {};
    const recommended: CoinScore[] = []
    Object.keys(scores).forEach(k => {
      const r = CoinScore.fromObject(scores[k]);
      if (r.getScore() > 0) {
        recommended.push(r);
      }
    })
    return recommended.sort((a, b) => b.getScore() - a.getScore()).slice(0, 10);
  }

  updateScores(): void {
    const scoresJson = CacheProxy.get('RecommenderMemos');
    const scores: CoinScoreMap = scoresJson ? JSON.parse(scoresJson) : this.store.get('SurvivorScores') || {};
    const coinsRaisedAmidMarkedDown: CoinScoreMap = {};
    const prices = this.exchange.getPrices();
    Object.keys(prices).forEach(s => {
      const coinName = s.endsWith(StableUSDCoin.USDT) ? s.split(StableUSDCoin.USDT)[0] : null;
      if (coinName) {
        const price = prices[s];
        const score = CoinScore.new(coinName, scores[s]);
        score.pushPrice(price)
        score.priceGoesUp() && (coinsRaisedAmidMarkedDown[s] = score)
        scores[s] = score;
      }
    })

    // if only MARKET_UP_FRACTION% of coins go up, we update their recommendation score
    const fractionMet = Object.keys(coinsRaisedAmidMarkedDown).length <= (this.MARKET_UP_FRACTION * Object.keys(prices).length);
    if (fractionMet && Object.keys(coinsRaisedAmidMarkedDown).length > 0) {
      Object.values(coinsRaisedAmidMarkedDown).forEach(r => r.incrementScore());
      Log.info('Updated survivors.');
    }

    CacheProxy.put('RecommenderMemos', JSON.stringify(scores));

    // Sync the scores to store every 6 hours
    if (!CacheProxy.get('SurvivorScoresSynced')) {
      this.store.set('SurvivorScores', scores);
      CacheProxy.put('SurvivorScoresSynced', 'true', 6 * 60 * 60); // 6 hours
    }
  }

  resetScores(): void {
    // todo: make concurrent safe
    CacheProxy.put('RecommenderMemos', JSON.stringify({}));
    this.store.set('SurvivorScores', {});
    CacheProxy.put('SurvivorScoresSynced', 'true', 6 * 60 * 60); // 6 hours
  }
}
