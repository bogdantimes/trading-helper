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
      .reduce((acc, v) => {
        const cs = CoinScore.fromObject(v)
        if (cs.score > 0) acc.push(cs)
        return acc
      }, [] as CoinScore[])
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

    let notGainers = 0
    let notLosers = 0
    const strongGainers: CoinScoreMap = {}
    const strongLosers: CoinScoreMap = {}
    const prices = this.exchange.getPrices()

    Object.keys(prices).forEach((s) => {
      if (!s.endsWith(StableUSDCoin.USDT)) return

      const coinName = s.split(StableUSDCoin.USDT)[0]
      const cs = new CoinScore(coinName, scores[s])
      cs.pushPrice(prices[s])

      const priceMove = cs.getPriceMove()
      if (priceMove >= PriceMove.NEUTRAL) notLosers++
      if (priceMove <= PriceMove.NEUTRAL) notGainers++
      if (priceMove === PriceMove.STRONG_UP) strongGainers[s] = cs
      if (priceMove === PriceMove.STRONG_DOWN) strongLosers[s] = cs
      scores[s] = cs
    })

    // Update scores only if there is a small percentage of coins that are gainers or losers
    // while prevailing is the opposite.
    const totalCoins = Object.keys(scores).length
    const isTinyFraction = (n) => n > 0 && n <= this.TINY_FRACTION * totalCoins
    const isPrevailingFraction = (n) => n <= totalCoins && n > (1 - this.TINY_FRACTION) * totalCoins
    // Updating gainers
    if (isTinyFraction(Object.keys(strongGainers).length) && isPrevailingFraction(notGainers)) {
      Object.values(strongGainers).forEach((r) => r.scoreUp())
      Log.alert(`Score incremented for ${Object.keys(strongGainers).join(`, `)}.`)
    }
    // Updating losers
    if (isTinyFraction(Object.keys(strongLosers).length) && isPrevailingFraction(notLosers)) {
      Object.values(strongLosers).forEach((r) => r.scoreDown())
      Log.alert(`Score decremented for ${Object.keys(strongLosers).join(`, `)}.`)
    }

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
