import { IStore } from "./Store"
import { CacheProxy } from "./CacheProxy"
import { StableUSDCoin } from "../shared-lib/types"
import { IExchange } from "./Exchange"
import { Log } from "./Common"
import { CoinScore } from "../shared-lib/CoinScore"

export interface ScoresManager {
  getScores(): CoinScore[]

  updateScores(): void

  resetScores(): void
}

type CoinScoreMap = { [key: string]: CoinScore }

export class Scores implements ScoresManager {
  private readonly MARKET_THRESHOLD = 0.01 // 1% (Binance has 2030 prices right now, 1% is ~20 coins)
  private store: IStore
  private exchange: IExchange

  constructor(store: IStore, exchange: IExchange) {
    this.store = store
    this.exchange = exchange
  }

  /**
   * Returns symbols that raised in price when most of the marked was going down.
   * Returns first ten recommended symbols if there are more than ten.
   * Sorted by recommendation score.
   */
  getScores(): CoinScore[] {
    const scoresJson = CacheProxy.get(`RecommenderMemos`)
    const scores: CoinScoreMap = scoresJson ? JSON.parse(scoresJson) : {}
    return Object.values(scores)
      .map(CoinScore.fromObject)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }

  updateScores(): void {
    const scoresJson = CacheProxy.get(`RecommenderMemos`)
    const scores: CoinScoreMap = scoresJson
      ? JSON.parse(scoresJson)
      : this.store.get(`SurvivorScores`) || {}
    const gainers: CoinScoreMap = {}
    const losers: CoinScoreMap = {}
    const prices = this.exchange.getPrices()
    Object.keys(prices).forEach((s) => {
      const coinName = s.endsWith(StableUSDCoin.USDT) ? s.split(StableUSDCoin.USDT)[0] : null
      if (coinName) {
        const price = prices[s]
        const cs = new CoinScore(coinName, scores[s])
        cs.pushPrice(price)
        cs.priceGoesUpStrong() && (gainers[s] = cs)
        cs.priceGoesDownStrong() && (losers[s] = cs)
        scores[s] = cs
      }
    })

    // Update scores only if there is a small percentage of coins that are gainers or losers
    const withinRange = (n) => n > 0 && n <= this.MARKET_THRESHOLD * Object.keys(prices).length
    if (withinRange(Object.keys(gainers).length) || withinRange(Object.keys(losers).length)) {
      Object.values(gainers).forEach((r) => r.scoreUp())
      Object.values(losers).forEach((r) => r.scoreDown())
      Log.info(`Updated scores.`)
    }

    // delete zero scores from scores
    Object.keys(scores).forEach((k) => !scores[k].score && delete scores[k])

    CacheProxy.put(`RecommenderMemos`, JSON.stringify(scores))

    // Sync the scores to store every 6 hours
    if (!CacheProxy.get(`ScoresSynced`)) {
      this.store.set(`SurvivorScores`, scores)
      CacheProxy.put(`ScoresSynced`, `true`, 3 * 60 * 60) // 3 hours
    }
  }

  resetScores(): void {
    // todo: make concurrent safe
    CacheProxy.put(`RecommenderMemos`, JSON.stringify({}))
    this.store.set(`SurvivorScores`, {})
    CacheProxy.put(`ScoresSynced`, `true`, 6 * 60 * 60) // 6 hours
  }
}
