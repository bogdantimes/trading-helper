import { CacheProxy } from "../CacheProxy"
import { Log, SECONDS_IN_MIN } from "../Common"
import {
  absPercentageChange,
  CoinName, Config,
  IPriceProvider,
  PricesHolder,
  TradeState,
} from "trading-helper-lib"
import { TradeActions } from "../TradeActions"
import { IStore } from "../Store"

export enum PriceAnomaly {
  NONE,
  PUMP,
  DUMP,
  TRACKING,
}

export class AnomalyTrader {
  private readonly store: IStore
  private readonly config: Config
  private readonly priceProvider: IPriceProvider
  private readonly tradeActions = TradeActions.default()

  constructor(store: IStore, priceProvider: IPriceProvider) {
    this.store = store
    this.config = store.getConfig()
    this.priceProvider = priceProvider
  }

  public trade(): void {
    const prices = this.priceProvider.get(this.config.StableCoin)

    Object.keys(prices).forEach((coin: CoinName) => {
      const anomaly = this.check(coin, prices[coin])
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
      }
    })
  }

  private check(coin: CoinName, ph: PricesHolder): PriceAnomaly {
    const trackingKey = `${coin}-pump-dump-tracking`
    const tracking = CacheProxy.get(trackingKey)
    const startPriceKey = `${coin}-start-price`
    const anomalyStartPrice = CacheProxy.get(startPriceKey)

    if (tracking || ph.priceGoesStrongUp() || ph.priceGoesStrongDown()) {
      // If price STRONG move repeats within 3 minutes, we keep tracking the anomaly
      CacheProxy.put(trackingKey, `true`, SECONDS_IN_MIN * 3)
      // Saving the max or min price of the anomaly depending on the direction
      const minMaxPrice = ph.priceGoesStrongUp() ? Math.min(...ph.prices) : Math.max(...ph.prices)
      CacheProxy.put(startPriceKey, `${anomalyStartPrice || minMaxPrice}`)
      return PriceAnomaly.TRACKING
    }

    if (!anomalyStartPrice) {
      return PriceAnomaly.NONE
    }

    CacheProxy.remove(startPriceKey)
    const percent = absPercentageChange(+anomalyStartPrice, ph.currentPrice)

    if (percent < this.config.PriceAnomalyAlert) {
      return PriceAnomaly.NONE
    }

    if (+anomalyStartPrice > ph.currentPrice) {
      Log.alert(
        `📉 ${coin} price dumped for ${percent}%: ${anomalyStartPrice} -> ${ph.currentPrice}`,
      )
      return PriceAnomaly.DUMP
    }

    if (+anomalyStartPrice < ph.currentPrice) {
      Log.alert(
        `📈 ${coin} price pumped for ${percent}%: ${anomalyStartPrice} -> ${ph.currentPrice}`,
      )
      return PriceAnomaly.PUMP
    }

    return PriceAnomaly.NONE
  }
}
