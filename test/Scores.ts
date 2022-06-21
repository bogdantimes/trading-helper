import {
  CoinScore,
  Config,
  enumKeys,
  IPriceProvider,
  MarketMove,
  PriceMove,
  ScoresData,
  ScoreSelectivityKeys,
} from "trading-helper-lib"
import { ScoreSelectivity } from "trading-helper-lib/dist/Types"
import { PriceHoldersMap } from "trading-helper-lib/dist/IPriceProvider"
import { IScores } from "../src/gas/Scores"
import { IStore } from "../src/gas/Store"

interface CoinScoreMap {
  [key: string]: CoinScore
}

export class Scores implements IScores {
  private readonly store: IStore
  private readonly priceProvider: IPriceProvider
  private readonly config: Config

  constructor(store: IStore, priceProvider: IPriceProvider, config: Config) {
    this.store = store
    this.priceProvider = priceProvider
    this.config = config
  }

  get(): ScoresData {
    return {
      realData: true,
      marketMove: this.#getMarketMove(),
      recommended: this.#getRecommended(),
    }
  }

  update(): void {
    const prices = this.priceProvider.get(this.config.StableCoin)

    const marketMove = this.#calculateMarketMove(prices)

    this.store.set(`MarketMove`, this.#convertValuesToPercentages(marketMove))

    this.#updateScores(prices, marketMove)
  }

  /**
   * Returns coins that raised in price when most of the marked was going down.
   * Returns first ten recommended coins sorted by the recommendation score.
   */
  #getRecommended(): CoinScore[] {
    const selectivity = this.config.ScoreSelectivity as ScoreSelectivityKeys
    const scores = this.#getScores()
    return Object.values(scores)
      .reduce<CoinScore[]>((acc, v) => {
        const cs = CoinScore.fromObject(v)
        if (cs.getScore(selectivity) > 0) acc.push(cs)
        return acc
      }, [])
      .sort((a, b) => b.getScore(selectivity) - a.getScore(selectivity))
      .slice(0, 10)
  }

  #getMarketMove(): MarketMove {
    return this.store.getOrSet(`MarketMove`, {
      [PriceMove.STRONG_DOWN]: 0,
      [PriceMove.DOWN]: 0,
      [PriceMove.NEUTRAL]: 0,
      [PriceMove.UP]: 0,
      [PriceMove.STRONG_UP]: 0,
    })
  }

  #updateScores(prices: PriceHoldersMap, marketMove: MarketMove): void {
    const selectivity = this.config.ScoreSelectivity as ScoreSelectivityKeys
    const scores = this.#getScores()

    const gainersMap: CoinScoreMap = {}
    const losersMap: CoinScoreMap = {}

    Object.keys(prices).forEach((coinName) => {
      const cs = new CoinScore(coinName, scores[coinName])
      CoinScore.migrateOldScore(scores[coinName], cs, selectivity) // TODO: remove this line after migration
      const priceMove = prices[coinName].getPriceMove()

      if (priceMove >= PriceMove.UP) gainersMap[coinName] = cs
      if (priceMove <= PriceMove.DOWN) losersMap[coinName] = cs

      scores[coinName] = cs
    })

    // Update scores only if there is a small percentage of coins that are gainers or losers
    // while prevailing is the opposite.
    const total = this.#countTotal(marketMove)
    const nonGainersCount = this.#countNonGainers(marketMove)
    const nonLosersCount = this.#countNonLosers(marketMove)

    const belowCutoff = (s: number, n: number): boolean => n > 0 && n <= s * total
    const aboveCutoff = (s: number, n: number): boolean => n <= total && n > (1 - s) * total

    enumKeys<ScoreSelectivityKeys>(ScoreSelectivity).forEach((key) => {
      const v = ScoreSelectivity[key]
      const gainers = Object.values(gainersMap)
      // Increment score if the gainer is below the score selectivity cutoff
      if (belowCutoff(v, gainers.length) && aboveCutoff(v, nonGainersCount)) {
        gainers.forEach((r) => r.addScore(key, 1))
      }
      const losers = Object.values(losersMap)
      // Decrement score if the loser is below the score selectivity cutoff
      if (belowCutoff(v, losers.length) && aboveCutoff(v, nonLosersCount)) {
        losers.forEach((r) => r.addScore(key, -1))
      }
    })

    this.#setScores(scores)
  }

  reset(): void {
    this.#setScores({})
  }

  #getScores(): CoinScoreMap {
    return this.store.getOrSet(`SurvivorScores`, {})
  }

  #setScores(scores: CoinScoreMap): CoinScoreMap {
    return this.store.set(`SurvivorScores`, scores)
  }

  #calculateMarketMove(prices: PriceHoldersMap): MarketMove {
    return Object.keys(prices).reduce(
      (marketMove, coinName) => {
        marketMove[prices[coinName].getPriceMove()]++
        return marketMove
      },
      {
        [PriceMove.STRONG_DOWN]: 0,
        [PriceMove.DOWN]: 0,
        [PriceMove.NEUTRAL]: 0,
        [PriceMove.UP]: 0,
        [PriceMove.STRONG_UP]: 0,
      },
    )
  }

  #countNonLosers(marketMove: MarketMove): number {
    return (
      marketMove[PriceMove.STRONG_UP] + marketMove[PriceMove.UP] + marketMove[PriceMove.NEUTRAL]
    )
  }

  #countNonGainers(marketMove: MarketMove): number {
    return (
      marketMove[PriceMove.STRONG_DOWN] + marketMove[PriceMove.DOWN] + marketMove[PriceMove.NEUTRAL]
    )
  }

  #countTotal(map: object): number {
    return Object.values(map).reduce((acc: number, v: number) => acc + v, 0)
  }

  #convertValuesToPercentages(map: MarketMove): MarketMove {
    const result: any = {}
    const totalCount = this.#countTotal(map)
    enumKeys<keyof MarketMove>(map).forEach((key) => {
      result[key] = (100 * map[key]) / totalCount
    })
    return result as MarketMove
  }
}
