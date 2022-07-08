import { DefaultStore } from "./Store"
import { Log, StopWatch } from "./Common"
import { CacheProxy } from "./CacheProxy"
import { PriceProvider } from "./PriceProvider"
import { PDTrader } from "./traders/PDTrader"
import { TradeActions } from "./TradeActions"
import { TraderPlugin, TradingContext } from "./traders/pro/api"

export class Process {
  static tick() {
    const stopWatch = new StopWatch((...args) => Log.debug(...args))

    const store = DefaultStore
    const tradeActions = TradeActions.default()
    const priceProvider = PriceProvider.getInstance(tradeActions.exchange, CacheProxy)
    const pdTrader = new PDTrader(CacheProxy, tradeActions)

    // Updating prices every tick
    // This should be the only place to call `update` on the price provider.
    stopWatch.start(`Prices update`)
    priceProvider.update()
    stopWatch.stop()

    try {
      stopWatch.start(`Trades check`)
      tradeActions.defaultTrader.trade()
      stopWatch.stop()
    } catch (e) {
      Log.alert(`Failed to trade: ${e.message}`)
      Log.error(e)
    }

    try {
      stopWatch.start(`Stable Coins update`)
      tradeActions.defaultTrader.updateStableCoinsBalance(store)
      stopWatch.stop()
    } catch (e) {
      Log.alert(`Failed to update stable coins balance: ${e.message}`)
      Log.error(e)
    }

    try {
      stopWatch.start(`PDTrader check`)
      pdTrader.trade()
      stopWatch.stop()
    } catch (e) {
      Log.alert(`Failed to trade pump dump anomalies: ${e.message}`)
      Log.error(e)
    }

    try {
      stopWatch.start(`Library check`)
      const context: TradingContext = {
        store,
        tradeActions,
      }
      const libTrader: TraderPlugin = global.TradingHelperLibrary
      libTrader.trade(context)
      stopWatch.stop()
    } catch (e) {
      Log.alert(`Failed to trade channel anomalies: ${e.message}`)
      Log.error(e)
    }
  }
}
