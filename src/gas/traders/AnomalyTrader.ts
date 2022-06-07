import { DefaultCacheProxy } from "../CacheProxy";
import { Log, SECONDS_IN_MIN } from "../Common";
import {
  absPercentageChange,
  CoinName,
  Config,
  IPriceProvider,
  PriceHoldersMap,
  PricesHolder,
  TradeState
} from "trading-helper-lib";
import { TradeActions } from "../TradeActions";
import { IStore } from "../Store";

export enum PriceAnomaly {
  NONE,
  PUMP,
  DUMP,
  TRACKING,
  FLAT,
}

interface Duration {
  minutes: number
}

const channelHeightPercentage = 0.05

export class AnomalyTrader {
  private readonly store: IStore
  private readonly cache: DefaultCacheProxy
  private readonly config: Config
  private readonly priceProvider: IPriceProvider
  private readonly tradeActions = TradeActions.default()

  constructor(store: IStore, cache: DefaultCacheProxy, priceProvider: IPriceProvider) {
    this.store = store
    this.cache = cache
    this.config = store.getConfig()
    this.priceProvider = priceProvider
  }

  public trade(): void {
    const prices = this.priceProvider.get(this.config.StableCoin)

    // Performance improvement: populating cache map once for all
    const cacheMap = this.populateCacheMap(prices);

    Object.keys(prices).forEach((coin: CoinName) => {
      const anomaly = this.check(coin, prices[coin], cacheMap)
      if (anomaly === PriceAnomaly.DUMP && this.config.BuyDumps) {
        Log.alert(`ℹ️ Buying price dumps is enabled: ${coin} will be bought.`)
        this.tradeActions.buy(coin)
      } else if (anomaly === PriceAnomaly.PUMP && this.config.SellPumps) {
        this.store.changeTrade(coin, tm => {
          if (tm.profit() > 0) {
            Log.alert(`ℹ️ Selling price pumps is enabled: ${coin} will be sold.`)
            tm.setState(TradeState.SELL)
            return tm
          }
        })
      } else if (anomaly === PriceAnomaly.FLAT) {
        Log.alert(`ℹ️${coin} price is flat.`)
      }
    })
  }

  private populateCacheMap(prices: PriceHoldersMap) {
    const cacheKeys = [];
    Object.keys(prices).forEach(coin => {
      cacheKeys.push(`${coin}-pump-dump-tracking`);
      cacheKeys.push(`${coin}-start-price`);
    });
    return this.cache.getAll(cacheKeys);
  }

  private check(coin: CoinName, ph: PricesHolder, cacheMap: { [key: string]: any }): PriceAnomaly {
    const trackingKey = `${coin}-pump-dump-tracking`
    const tracking = cacheMap[trackingKey]
    const startPriceKey = `${coin}-start-price`
    const pumpDumpStartPrice = cacheMap[startPriceKey]

    if (tracking || ph.priceGoesStrongUp() || ph.priceGoesStrongDown()) {
      // If price STRONG move repeats within 3 minutes, we keep tracking the anomaly
      this.cache.put(trackingKey, `true`, SECONDS_IN_MIN * 3)
      // Saving the max or min price of the anomaly depending on the direction
      const minMaxPrice = ph.priceGoesStrongUp() ? Math.min(...ph.prices) : Math.max(...ph.prices)
      this.cache.put(startPriceKey, `${pumpDumpStartPrice || minMaxPrice}`)
      return PriceAnomaly.TRACKING
    }

    if (!pumpDumpStartPrice) {
      // if neither pumping nor dumping, check if price is flat (inside channel)
      const flatPriceDuration = this.priceInsideChannel(coin, ph, cacheMap, channelHeightPercentage)
      // if more than 1 hour - we consider it a flat price
      return flatPriceDuration.minutes >= 5 ? PriceAnomaly.FLAT : PriceAnomaly.NONE
    }

    this.cache.remove(startPriceKey)
    const percent = absPercentageChange(+pumpDumpStartPrice, ph.currentPrice)

    if (percent < this.config.PriceAnomalyAlert) {
      return PriceAnomaly.NONE
    }

    if (+pumpDumpStartPrice > ph.currentPrice) {
      Log.alert(
        `📉 ${coin} price dumped for ${percent}%: ${pumpDumpStartPrice} -> ${ph.currentPrice}`,
      )
      return PriceAnomaly.DUMP
    }

    if (+pumpDumpStartPrice < ph.currentPrice) {
      Log.alert(
        `📈 ${coin} price pumped for ${percent}%: ${pumpDumpStartPrice} -> ${ph.currentPrice}`,
      )
      return PriceAnomaly.PUMP
    }

    return PriceAnomaly.NONE
  }

  priceInsideChannel(
    coin: CoinName,
    ph: PricesHolder,
    cacheMap: { [key: string]: any },
    percentage: number,
  ): Duration {
    const channelTrackingKey = `${coin}-channel-tracking`
    const channel = cacheMap[channelTrackingKey] ? JSON.parse(cacheMap[channelTrackingKey]) : null
    const minPrice = Math.min(...ph.prices)
    const maxPrice = Math.max(...ph.prices)

    if (channel) {
      const topPrice = channel.topPrice
      const bottomPrice = channel.bottomPrice
      const startTime = channel.startTime

      if (minPrice >= bottomPrice && maxPrice <= topPrice) {
        // Still inside channel, return the duration
        return {
          minutes: Math.floor((Date.now() - startTime) / 1000 / 60),
        }
      }
    }

    const avgPrice = (minPrice + maxPrice) / 2
    const topPrice = avgPrice * (1 + percentage / 2)
    const bottomPrice = avgPrice * (1 - percentage / 2)
    const startTime = Date.now()
    this.cache.put(channelTrackingKey, JSON.stringify({ topPrice, bottomPrice, startTime }))
    return { minutes: 0 }
  }
}
