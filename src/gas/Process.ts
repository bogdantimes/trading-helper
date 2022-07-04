import { DefaultTrader } from "./traders/DefaultTrader"
import { Exchange } from "./Exchange"
import { Statistics } from "./Statistics"
import { DefaultStore } from "./Store"
import { Log, StopWatch } from "./Common"
import { ScoreTrader } from "./traders/ScoreTrader"
import { CacheProxy } from "./CacheProxy"
import { Scores } from "./Scores"
import { PriceProvider } from "./PriceProvider"
import { PDTrader } from "./traders/PDTrader"
import { TradesDao } from "./dao/Trades"
import { ConfigDao } from "./dao/Config"
import { TradeActions } from "./TradeActions"
import { TraderPlugin, TradingContext } from "./traders/pro/api"

export class Process {
  static tick() {
    const stopWatch = new StopWatch((...args) => Log.debug(...args))

    const store = DefaultStore
    const tradesDao = new TradesDao(store)
    const configDao = new ConfigDao(store)

    const config = configDao.get()
    const exchange = new Exchange(config.KEY, config.SECRET)
    const statistics = new Statistics(store)
    const priceProvider = PriceProvider.getInstance(exchange, CacheProxy)
    const tradeActions = new TradeActions(tradesDao, config.StableCoin, priceProvider)
    const defaultTrader = new DefaultTrader(
      tradesDao,
      configDao,
      exchange,
      priceProvider,
      statistics,
    )
    const scores = new Scores(DefaultStore, priceProvider, config)
    const scoreTrader = new ScoreTrader(configDao, tradesDao, scores, tradeActions)
    const pdTrader = new PDTrader(tradesDao, configDao, CacheProxy, priceProvider, tradeActions)

    // Updating prices every tick
    // This should be the only place to call `update` on the price provider.
    stopWatch.start(`Prices update`)
    priceProvider.update()
    stopWatch.stop()

    try {
      stopWatch.start(`Trades check`)
      defaultTrader.trade()
      stopWatch.stop()
    } catch (e) {
      Log.alert(`Failed to trade: ${e.message}`)
      Log.error(e)
    }

    try {
      stopWatch.start(`Stable Coins update`)
      defaultTrader.updateStableCoinsBalance(store)
      stopWatch.stop()
    } catch (e) {
      Log.alert(`Failed to update stable coins balance: ${e.message}`)
      Log.error(e)
    }

    try {
      stopWatch.start(`Scores update`)
      scores.update()
      stopWatch.stop()
    } catch (e) {
      Log.alert(`Failed to update scores: ${e.message}`)
      Log.error(e)
    }

    try {
      stopWatch.start(`Recommended coins check`)
      scoreTrader.trade()
      stopWatch.stop()
    } catch (e) {
      Log.alert(`Failed to trade recommended coins: ${e.message}`)
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
        priceProvider,
        configDao,
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
