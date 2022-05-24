import { CacheProxy } from "./CacheProxy"
import { Log } from "./Common"
import { TradeMemo } from "../shared-lib/TradeMemo"
import { absPercentageChange } from "../shared-lib/functions"
import { PriceMove } from "../shared-lib/types"

export enum PriceAnomaly {
  NONE,
  PUMP,
  DUMP,
  TRACKING,
}

export class PriceAnomalyChecker {
  public static check(tm: TradeMemo, pdAlertPercentage: number): PriceAnomaly {
    if (tm.prices.length < TradeMemo.PriceMemoMaxCapacity) {
      return PriceAnomaly.NONE
    }

    const key = `${tm.getCoinName()}-pump-dump-start`
    const anomalyStartPrice = CacheProxy.get(key)

    const dump = tm.getPriceMove() === PriceMove.STRONG_DOWN
    const pump = tm.getPriceMove() === PriceMove.STRONG_UP

    if (pump || dump) {
      Log.debug(`${tm.getCoinName()} price anomaly detected`)
      CacheProxy.put(key, anomalyStartPrice || tm.prices[0].toString(), 120) // 2 minutes
      return PriceAnomaly.TRACKING
    }

    if (!anomalyStartPrice) {
      return PriceAnomaly.NONE
    }

    CacheProxy.remove(key)
    const percent = absPercentageChange(+anomalyStartPrice, tm.currentPrice)

    if (percent < pdAlertPercentage) {
      return PriceAnomaly.NONE
    }

    if (+anomalyStartPrice > tm.currentPrice) {
      Log.alert(`${tm.getCoinName()} price dumped for ${percent}%: ${anomalyStartPrice} -> ${tm.currentPrice}`)
      return PriceAnomaly.DUMP
    }

    if (+anomalyStartPrice < tm.currentPrice) {
      Log.alert(`${tm.getCoinName()} price pumped for ${percent}%: ${anomalyStartPrice} -> ${tm.currentPrice}`)
      return PriceAnomaly.PUMP
    }

    return PriceAnomaly.NONE
  }
}
