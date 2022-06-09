import { DefaultCacheProxy } from "../CacheProxy"
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
import { AssetsDao } from "../dao/Assets"
import { IStore } from "../Store"

export enum PriceAnomaly {
  NONE,
  PUMP,
  DUMP,
  TRACKING,
}

export class AnomalyTrader {
  private readonly cache: DefaultCacheProxy
  private readonly config: Config
  private readonly priceProvider: IPriceProvider
  private readonly tradeActions = TradeActions.default()
  private readonly assetsDao: AssetsDao

  constructor(store: IStore, cache: DefaultCacheProxy, priceProvider: IPriceProvider) {
    this.cache = cache
    this.config = store.getConfig()
    this.priceProvider = priceProvider
    this.assetsDao = new AssetsDao(store, cache)
  }

  public trade(): void {
    const prices = this.priceProvider.get(this.config.StableCoin)

    // Performance improvement: populating cache map once for all
    const cacheMap = this.populateCacheMap(prices)

    Object.keys(prices).forEach((coin: CoinName) => {
      const anomaly = this.checkPumpAndDump(coin, prices[coin], cacheMap)
      this.handleAnomaly(coin, anomaly)
    })
  }

  private handleAnomaly(coin: string, anomaly: PriceAnomaly) {
    if (anomaly === PriceAnomaly.DUMP && this.config.BuyDumps) {
      Log.alert(`ℹ️ Buying price dumps is enabled: ${coin} will be bought.`)
      this.tradeActions.buy(coin)
      return
    }

    if (anomaly === PriceAnomaly.PUMP && this.config.SellPumps) {
      this.assetsDao.update(coin, (tm) => {
        if (tm.profit() > 0) {
          Log.alert(`ℹ️ Selling price pumps is enabled: ${coin} will be sold.`)
          tm.setState(TradeState.SELL)
          return tm
        }
      })
      return
    }
  }

  private populateCacheMap(prices: PriceHoldersMap) {
    const cacheKeys = []
    Object.keys(prices).forEach((coin) => {
      cacheKeys.push(`${coin}-pump-dump-tracking`)
      cacheKeys.push(`${coin}-start-price`)
    })
    return this.cache.getAll(cacheKeys)
  }

  private checkPumpAndDump(
    coin: CoinName,
    ph: PricesHolder,
    cacheMap: { [key: string]: any },
  ): PriceAnomaly {
    const trackingKey = `${coin}-pump-dump-tracking`
    const tracking = cacheMap[trackingKey]
    const startPriceKey = `${coin}-start-price`
    const anomalyStartPrice = cacheMap[startPriceKey]

    if (tracking || ph.priceGoesStrongUp() || ph.priceGoesStrongDown()) {
      // If price STRONG move repeats within 3 minutes, we keep tracking the anomaly
      this.cache.put(trackingKey, `true`, SECONDS_IN_MIN * 3)
      // Saving the max or min price of the anomaly depending on the direction
      const minMaxPrice = ph.priceGoesStrongUp() ? Math.min(...ph.prices) : Math.max(...ph.prices)
      this.cache.put(startPriceKey, `${anomalyStartPrice || minMaxPrice}`)
      return PriceAnomaly.TRACKING
    }

    if (!anomalyStartPrice) {
      return PriceAnomaly.NONE
    }

    this.cache.remove(startPriceKey)
    const percent = absPercentageChange(+anomalyStartPrice, ph.currentPrice)

    if (percent < this.config.PriceAnomalyAlert) {
      return PriceAnomaly.NONE
    }

    if (+anomalyStartPrice > ph.currentPrice) {
      Log.alert(
        `ℹ️${coin} price dumped for ${percent}%: ${anomalyStartPrice} -> ${ph.currentPrice}`,
      )
      return PriceAnomaly.DUMP
    }

    if (+anomalyStartPrice < ph.currentPrice) {
      Log.alert(
        `ℹ️${coin} price pumped for ${percent}%: ${anomalyStartPrice} -> ${ph.currentPrice}`,
      )
      return PriceAnomaly.PUMP
    }

    return PriceAnomaly.NONE
  }
}
