import { IStore } from "./Store"
import { CacheProxy } from "./CacheProxy"
import { MarketMove, PriceMove, StableUSDCoin } from "../shared-lib/types"
import { IExchange } from "./Exchange"
import { CoinScore } from "../shared-lib/CoinScore"

type CoinScoreMap = { [key: string]: CoinScore }

export class ScoresManager {
  private readonly STABLE_COIN = StableUSDCoin.BUSD // Using Binance USD as best for Binance
  private readonly CACHE_SYNC_INTERVAL = 3 * 60 * 60 // 3 hours

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

  getMarketMove(): MarketMove {
    const json = CacheProxy.get(`MarketMove`)
    return json ? JSON.parse(json) : {}
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

    let strongLosersCount = 0
    let losersCount = 0
    let neutralCount = 0
    let gainersCount = 0
    let strongGainersCount = 0
    let totalCount = 0

    const gainers: CoinScoreMap = {}
    const losers: CoinScoreMap = {}
    const prices = this.exchange.getPrices()

    Object.keys(prices).forEach((s) => {
      if (!s.endsWith(this.STABLE_COIN)) return

      const coinName = s.split(this.STABLE_COIN)[0]
      const cs = new CoinScore(coinName, scores[coinName] || scores[s])
      cs.pushPrice(prices[s])

      const priceMove = cs.getPriceMove()

      if (priceMove === PriceMove.STRONG_DOWN) strongLosersCount++
      if (priceMove === PriceMove.DOWN) losersCount++
      if (priceMove === PriceMove.NEUTRAL) neutralCount++
      if (priceMove === PriceMove.UP) gainersCount++
      if (priceMove === PriceMove.STRONG_UP) strongGainersCount++

      if (priceMove >= PriceMove.UP) gainers[coinName] = cs
      if (priceMove <= PriceMove.DOWN) losers[coinName] = cs

      totalCount++
      scores[coinName] = cs
      delete scores[s] // Clean old key. Key fmt changed from BTCUSDT to BTC.
    })

    // Update scores only if there is a small percentage of coins that are gainers or losers
    // while prevailing is the opposite.
    const threshold = this.store.getConfig().ScoreGainersThreshold
    const isRare = (n) => n > 0 && n <= threshold * totalCount
    const isPrevailing = (n) => n <= totalCount && n > (1 - threshold) * totalCount
    // Updating gainers
    const gainersOpposite = strongLosersCount + losersCount + neutralCount
    if (isRare(Object.keys(gainers).length) && isPrevailing(gainersOpposite)) {
      Object.values(gainers).forEach((r) => r.scoreUp())
    }
    // Updating losers
    const losersOpposite = strongGainersCount + gainersCount + neutralCount
    if (isRare(Object.keys(losers).length) && isPrevailing(losersOpposite)) {
      Object.values(losers).forEach((r) => r.scoreDown())
    }

    const marketMove: MarketMove = {
      [PriceMove.STRONG_DOWN]: (100 * strongLosersCount) / totalCount,
      [PriceMove.DOWN]: (100 * losersCount) / totalCount,
      [PriceMove.NEUTRAL]: (100 * neutralCount) / totalCount,
      [PriceMove.UP]: (100 * gainersCount) / totalCount,
      [PriceMove.STRONG_UP]: (100 * strongGainersCount) / totalCount,
    }
    CacheProxy.put(`MarketMove`, JSON.stringify(marketMove))
    CacheProxy.put(`RecommenderMemos`, JSON.stringify(scores))

    // Sync the scores to store periodically.
    if (!CacheProxy.get(`ScoresSynced`)) {
      this.store.set(`SurvivorScores`, scores)
      CacheProxy.put(`ScoresSynced`, `true`, this.CACHE_SYNC_INTERVAL)
    }
  }

  resetScores(): void {
    // todo: make concurrent safe
    CacheProxy.put(`RecommenderMemos`, JSON.stringify({}))
    this.store.set(`SurvivorScores`, {})
    CacheProxy.put(`ScoresSynced`, `true`, this.CACHE_SYNC_INTERVAL)
  }
}
