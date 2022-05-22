import { TradeMemo } from './shared-lib/TradeMemo'
import { CacheProxy } from './CacheProxy'
import { Log } from './Common'
import { absPercentageChange } from './shared-lib/functions'

export enum PriceAnomaly {
  NONE,
  PUMP,
  DUMP,
}

export class PriceAnomalyChecker {
  public static check(tm: TradeMemo, pdAlertPercentage: number): PriceAnomaly {
    if (tm.prices.length < TradeMemo.PriceMemoMaxCapacity) {
      return PriceAnomaly.NONE;
    }

    const key = `${tm.getCoinName()}-pump-dump-start`;
    const changeIndex = tm.getPriceChangeIndex(tm.prices.slice(-TradeMemo.PriceMemoMaxCapacity));
    const anomalyStartPrice = CacheProxy.get(key);

    const strength = 0.8;
    const dump = changeIndex <= -(TradeMemo.PriceMemoMaxCapacity - 1) * strength;
    const pump = changeIndex >= (TradeMemo.PriceMemoMaxCapacity - 1) * strength;

    if (pump || dump) {
      Log.debug(`${tm.getCoinName()} price anomaly detected`)
      CacheProxy.put(key, anomalyStartPrice || tm.prices[0].toString(), 120) // 2 minutes
    }

    if (!anomalyStartPrice) {
      return PriceAnomaly.NONE;
    }

    CacheProxy.remove(key);
    const percent = absPercentageChange(+anomalyStartPrice, tm.currentPrice)

    if (percent < pdAlertPercentage) {
      return PriceAnomaly.NONE
    }

    if (+anomalyStartPrice > tm.currentPrice) {
      Log.alert(`${tm.getCoinName()} price dumped for ${percent}%: ${anomalyStartPrice} -> ${tm.currentPrice}`);
      return PriceAnomaly.DUMP
    }

    if (+anomalyStartPrice < tm.currentPrice) {
      Log.alert(`${tm.getCoinName()} price pumped for ${percent}%: ${anomalyStartPrice} -> ${tm.currentPrice}`);
      return PriceAnomaly.PUMP
    }

    return PriceAnomaly.NONE
  }
}
