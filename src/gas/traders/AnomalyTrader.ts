import { Log, SECONDS_IN_MIN } from "../Common"
import {
  absPercentageChange,
  CoinName,
  Config,
  IPriceProvider,
  PriceHoldersMap,
  PricesHolder,
  TradeState,
} from "trading-helper-lib"
import { TradeActions } from "../TradeActions"
import { IStore } from "../Store"
import { CacheProxy, Entries, ExpirationEntries } from "../CacheProxy"

export enum PriceAnomaly {
  NONE,
  PUMP,
  DUMP,
  TRACKING,
}

export class AnomalyTrader {
  private readonly store: IStore
  private readonly cache: CacheProxy
  private readonly config: Config
  private readonly priceProvider: IPriceProvider
  private readonly tradeActions: TradeActions

  #cacheGetAll: Entries
  #cachePutAll: ExpirationEntries = {}
  #cacheRemoveAll: string[] = []

  constructor(store: IStore, cache: CacheProxy, priceProvider: IPriceProvider) {
    this.store = store
    this.cache = cache
    this.config = store.getConfig()
    this.priceProvider = priceProvider
    this.tradeActions = TradeActions.default(store)
  }

  public trade(): void {
    const prices = this.priceProvider.get(this.config.StableCoin)

    // Performance improvement: populating cache map once for all
    this.#getAllCache(prices)

    const anomalies = Object.keys(prices).map((coin: CoinName) => {
      return { coin, anomaly: this.#checkAnomaly(coin, prices[coin]) }
    })

    // Performance improvement: update cache once for all
    this.#updateAllCache()

    anomalies.forEach(({ coin, anomaly }) => this.#handleAnomaly(coin, anomaly))
  }

  #handleAnomaly(coin: string, anomaly: PriceAnomaly) {
    if (anomaly === PriceAnomaly.DUMP && this.config.BuyDumps) {
      Log.alert(`ℹ️ Buying price dumps is enabled: ${coin} will be bought.`)
      this.tradeActions.buy(coin)
      return
    }

    if (anomaly === PriceAnomaly.PUMP && this.config.SellPumps) {
      this.store.changeTrade(coin, (tm) => {
        if (tm.profit() > 0) {
          Log.alert(`ℹ️ Selling price pumps is enabled: ${coin} will be sold.`)
          tm.setState(TradeState.SELL)
          return tm
        }
      })
      return
    }
  }

  #getAllCache(prices: PriceHoldersMap): void {
    const cacheKeys = []
    Object.keys(prices).forEach((coin) => {
      cacheKeys.push(`${coin}-pump-dump-tracking`)
      cacheKeys.push(`${coin}-start-price`)
    })
    this.#cacheGetAll = this.cache.getAll(cacheKeys)
  }

  #checkAnomaly(coin: CoinName, ph: PricesHolder): PriceAnomaly {
    const trackingKey = `${coin}-pump-dump-tracking`
    const tracking = this.#cacheGetAll[trackingKey]
    const startPriceKey = `${coin}-start-price`
    const anomalyStartPrice = this.#cacheGetAll[startPriceKey]

    if (tracking || ph.priceGoesStrongUp() || ph.priceGoesStrongDown()) {
      // If price STRONG move repeats within 3 minutes, we keep tracking the anomaly
      const trackingDuration = SECONDS_IN_MIN * 3
      this.#cachePutAll[trackingKey] = { value: `true`, expiration: trackingDuration }
      // Saving the max or min price of the anomaly depending on the direction
      const minMaxPrice = ph.priceGoesStrongUp() ? Math.min(...ph.prices) : Math.max(...ph.prices)
      this.#cachePutAll[startPriceKey] = {
        value: `${anomalyStartPrice || minMaxPrice}`,
        expiration: trackingDuration * 2,
      }
      return PriceAnomaly.TRACKING
    }

    if (!anomalyStartPrice) {
      return PriceAnomaly.NONE
    }

    this.#cacheRemoveAll.push(startPriceKey)
    const percent = absPercentageChange(+anomalyStartPrice, ph.currentPrice)

    if (percent < this.config.PriceAnomalyAlert) {
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
    this.cache.putAll(this.#cachePutAll)
    this.cache.removeAll(this.#cacheRemoveAll)
  }
}
