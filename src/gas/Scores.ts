import { IStore } from "./Store"
import { CacheProxy } from "./CacheProxy"
import { PriceMove, StableUSDCoin } from "../shared-lib/types"
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
  private readonly TINY_FRACTION = 0.01 // 1% (Binance has 2030 prices right now, 1% is ~20 coins)
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

  /**
   * Algorithm:
   *  1. get all coins prices
   *  2. for each coin, get the price move
   *  3. if the price move is neutral or downtrend - count it as a strong loser or as not a gainer
   *  4. if the price move is neutral or uptrend - count it as a strong gainer or as not a loser
   *  5. if there is a small percentage of coins that are gainers or losers while prevailing is the opposite
   *     - update the scores for such rare coins
   *  6. delete zero scores from scores
   *  7. save
   */
  updateScores(): void {
    const scoresJson = CacheProxy.get(`RecommenderMemos`)
    const scores: CoinScoreMap = scoresJson
      ? JSON.parse(scoresJson)
      : this.store.get(`SurvivorScores`) || {}
    const gainers: CoinScoreMap = {}
    const losers: CoinScoreMap = {}
    const prices = this.exchange.getPrices()
    let notGainers = 0
    let notLosers = 0
    Object.keys(prices).forEach((s) => {
      const coinName = s.endsWith(StableUSDCoin.USDT) ? s.split(StableUSDCoin.USDT)[0] : null
      if (coinName) {
        const price = prices[s]
        const cs = new CoinScore(coinName, scores[s])
        cs.pushPrice(price)

        const priceMove = cs.getPriceMove()
        if (priceMove <= PriceMove.NEUTRAL) {
          cs.priceGoesStrongDown() ? (losers[s] = cs) : notGainers++
        }
        if (priceMove >= PriceMove.NEUTRAL) {
          cs.priceGoesStrongUp() ? (gainers[s] = cs) : notLosers++
        }

        scores[s] = cs
      }
    })

    // Update scores only if there is a small percentage of coins that are gainers or losers
    // while prevailing is the opposite.
    const allMarket = Object.keys(prices).length
    const isTinyFraction = (n) => n > 0 && n <= this.TINY_FRACTION * allMarket
    const isPrevailingFraction = (n) => n <= allMarket && n > (1 - this.TINY_FRACTION) * allMarket
    // Updating gainers
    if (isTinyFraction(Object.keys(gainers).length) && isPrevailingFraction(notGainers)) {
      Object.values(gainers).forEach((r) => r.scoreUp())
      Log.alert(`Strong gainers found. Updated scores.`)
      Log.debug(`Strong gainers: ${Object.keys(gainers)}`)
    }
    // Updating losers
    if (isTinyFraction(Object.keys(losers).length) && isPrevailingFraction(notLosers)) {
      Object.values(losers).forEach((r) => r.scoreDown())
      Log.alert(`Strong losers found. Updated scores.`)
      Log.debug(`Strong losers: ${Object.keys(losers)}`)
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
