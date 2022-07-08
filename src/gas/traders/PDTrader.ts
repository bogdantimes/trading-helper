import { DefaultCacheProxy, Entries, ExpirationEntries } from "../CacheProxy"
import { CoinCacheKeys, Log, SECONDS_IN_MIN } from "../Common"
import {
  absPercentageChange,
  CoinName,
  Config,
  IPriceProvider,
  PriceAnomaly,
  PriceHoldersMap,
  PricesHolder,
  TradeState,
} from "../../lib"
import { TradeActions } from "../TradeActions"
import { TradesDao } from "../dao/Trades"
import { ConfigDao } from "../dao/Config"

export class PDTrader {
  readonly #cache: DefaultCacheProxy
  readonly #priceProvider: IPriceProvider
  readonly #tradesDao: TradesDao
  readonly #configDao: ConfigDao
  readonly #tradeActions: TradeActions

  #cacheGetAll: Entries = {}
  #cachePutAll: ExpirationEntries = {}
  #cacheRemoveAll: string[] = []
  #config: Config

  constructor(cache: DefaultCacheProxy, tradeActions: TradeActions) {
    this.#cache = cache
    this.#tradeActions = tradeActions
    this.#priceProvider = tradeActions.priceProvider
    this.#tradesDao = tradeActions.tradesDao
    this.#configDao = tradeActions.configDao
  }

  trade(): void {
    // Get current config
    this.#config = this.#configDao.get()

    if (!this.#config.SellPumps && !this.#config.BuyDumps) {
      return
    }

    const prices = this.#priceProvider.get(this.#config.StableCoin)

    this.#getAllCache(prices)

    Object.keys(prices).forEach((coin: CoinName) => {
      const anomaly = this.#checkPumpDump(coin, prices[coin])
      this.#handleAnomaly(coin, anomaly)
    })

    this.#updateAllCache()
  }

  #handleAnomaly(coin: string, anomaly: PriceAnomaly) {
    if (anomaly === PriceAnomaly.DUMP && this.#config.BuyDumps) {
      Log.alert(`ℹ️ Buying price dumps is enabled: ${coin} will be bought.`)
      this.#tradeActions.buy(coin)
      return
    }

    if (anomaly === PriceAnomaly.PUMP && this.#config.SellPumps) {
      this.#tradesDao.update(coin, (tm) => {
        if (tm.profit() > 0) {
          Log.alert(`ℹ️ Selling price pumps is enabled: ${coin} will be sold.`)
          tm.setState(TradeState.SELL)
          return tm
        }
      })
    }
  }

  #getAllCache(prices: PriceHoldersMap): void {
    const keys: string[] = []
    for (const keyFn of Object.values(CoinCacheKeys)) {
      keys.push(...Object.keys(prices).map(keyFn))
    }
    this.#cacheGetAll = this.#cache.getAll(keys)
  }

  #getCache(coin: CoinName, key: keyof typeof CoinCacheKeys): any {
    return this.#cacheGetAll[CoinCacheKeys[key](coin)]
  }

  #putCache(
    coin: CoinName,
    key: keyof typeof CoinCacheKeys,
    value: { expiration?: number; value: string },
  ): void {
    this.#cachePutAll[CoinCacheKeys[key](coin)] = value
  }

  #removeFromCache(coin: CoinName, key: keyof typeof CoinCacheKeys): void {
    this.#cacheRemoveAll.push(CoinCacheKeys[key](coin))
  }

  #checkPumpDump(coin: string, ph: PricesHolder) {
    if (!this.#config.SellPumps && !this.#config.BuyDumps) {
      return PriceAnomaly.NONE
    }

    const tracking = this.#getCache(coin, `PD_TRACKING`)
    const anomalyStartPrice = this.#getCache(coin, `START_PRICE`)

    const strongMove = ph.priceGoesStrongUp() || ph.priceGoesStrongDown()
    if (strongMove) {
      // If price strong move continues - refresh expirations and continue tracking
      const anomalyWindow = SECONDS_IN_MIN * 1.5
      this.#putCache(coin, `PD_TRACKING`, { value: `true`, expiration: anomalyWindow })
      // Saving the max or min price of the anomaly depending on the direction
      const minMaxPrice = ph.priceGoesStrongUp() ? Math.min(...ph.prices) : Math.max(...ph.prices)
      this.#putCache(coin, `START_PRICE`, {
        value: tracking ? `${anomalyStartPrice}` : `${minMaxPrice}`,
        expiration: anomalyWindow * 2,
      })
      return PriceAnomaly.TRACKING
    }
    if (tracking) {
      // no strong move, but still tracking
      return PriceAnomaly.TRACKING
    }
    if (!anomalyStartPrice) {
      return PriceAnomaly.NONE
    }

    this.#removeFromCache(coin, `START_PRICE`)
    const percent = absPercentageChange(+anomalyStartPrice, ph.currentPrice)

    if (this.#config.PriceAnomalyAlert && percent < this.#config.PriceAnomalyAlert) {
      return PriceAnomaly.NONE
    }

    if (+anomalyStartPrice > ph.currentPrice) {
      Log.alert(
        `ℹ️ ${coin} price dumped for ${percent}%: ${anomalyStartPrice} -> ${ph.currentPrice}`,
      )
      return PriceAnomaly.DUMP
    }

    if (+anomalyStartPrice < ph.currentPrice) {
      Log.alert(
        `ℹ️ ${coin} price pumped for ${percent}%: ${anomalyStartPrice} -> ${ph.currentPrice}`,
      )
      return PriceAnomaly.PUMP
    }

    return PriceAnomaly.NONE
  }

  #updateAllCache(): void {
    this.#cache.putAll(this.#cachePutAll)
    this.#cache.removeAll(this.#cacheRemoveAll)
    this.#cachePutAll = {}
    this.#cacheRemoveAll = []
  }
}
