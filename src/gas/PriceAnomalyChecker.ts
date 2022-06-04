import { CacheProxy } from "./CacheProxy"
import { Log } from "./Common"
import { absPercentageChange, TradeMemo } from "trading-helper-lib"

export enum PriceAnomaly {
  NONE,
  PUMP,
  DUMP,
  TRACKING,
}

export class PriceAnomalyChecker {
  public static check(tm: TradeMemo, pdAlertPercentage: number): PriceAnomaly {
    const trackingKey = `${tm.getCoinName()}-pump-dump-tracking`
    const tracking = CacheProxy.get(trackingKey)
    const startPriceKey = `${tm.getCoinName()}-start-price`
    const anomalyStartPrice = CacheProxy.get(startPriceKey)

    if (tracking || tm.priceGoesStrongUp() || tm.priceGoesStrongDown()) {
      !anomalyStartPrice && Log.alert(`${tm.getCoinName()} price anomaly detected`)
      // If price STRONG move repeats within 2 minutes, we keep tracking the anomaly
      CacheProxy.put(trackingKey, `true`, 120)
      CacheProxy.put(startPriceKey, anomalyStartPrice || tm.prices[0].toString())
      return PriceAnomaly.TRACKING
    }

    if (!anomalyStartPrice) {
      return PriceAnomaly.NONE
    }

    CacheProxy.remove(startPriceKey)
    const percent = absPercentageChange(+anomalyStartPrice, tm.currentPrice)

    if (percent < pdAlertPercentage) {
      return PriceAnomaly.NONE
    }

    if (+anomalyStartPrice > tm.currentPrice) {
      Log.alert(
        `📉 ${tm.getCoinName()} price dumped for ${percent}%: ${anomalyStartPrice} -> ${
          tm.currentPrice
        }`,
      )
      return PriceAnomaly.DUMP
    }

    if (+anomalyStartPrice < tm.currentPrice) {
      Log.alert(
        `📈 ${tm.getCoinName()} price pumped for ${percent}%: ${anomalyStartPrice} -> ${
          tm.currentPrice
        }`,
      )
      return PriceAnomaly.PUMP
    }

    return PriceAnomaly.NONE
  }
}
