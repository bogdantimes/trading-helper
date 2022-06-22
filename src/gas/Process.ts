import { DefaultTrader } from "./traders/DefaultTrader"
import { Exchange } from "./Exchange"
import { Statistics } from "./Statistics"
import { DefaultStore } from "./Store"
import { Log, StopWatch } from "./Common"
import { ScoreTrader } from "./traders/ScoreTrader"
import { CacheProxy } from "./CacheProxy"
import { IScores } from "./Scores"
import { PriceProvider } from "./PriceProvider"
import { AnomalyTrader } from "./traders/AnomalyTrader"
import { TradesDao } from "./dao/Trades"
import { ConfigDao } from "./dao/Config"
import { TradeActions } from "./TradeActions"

export class Process {
  static tick() {
    const stopWatch = new StopWatch((...args) => Log.debug(...args))

    const store = DefaultStore
    const tradesDao = new TradesDao(store)
    const configDao = new ConfigDao(store)

    const config = configDao.get()
    const exchange = new Exchange(config)
    const statistics = new Statistics(store)
    const priceProvider = PriceProvider.getInstance(exchange, CacheProxy)

    stopWatch.start(`Prices update`)
    // Update prices every tick. This should the only place to call `update` on the price provider.
    priceProvider.update()
    stopWatch.stop()

    const trader = new DefaultTrader(store, exchange, priceProvider, statistics)

    stopWatch.start(`Trades check`)
    tradesDao.getList().forEach((trade) => {
      try {
        tradesDao.update(trade.getCoinName(), (tm) => trader.tickerCheck(tm))
      } catch (e) {
        Log.error(e)
      }
    })
    stopWatch.stop()

    stopWatch.start(`Stable Coins update`)
    try {
      trader.updateStableCoinsBalance()
    } catch (e) {
      Log.alert(`Failed to read stable coins balance`)
      Log.error(e)
    }
    stopWatch.stop()

    const scores = global.TradingHelperScores.create(DefaultStore, priceProvider, config) as IScores

    stopWatch.start(`Scores update`)
    try {
      scores.update()
    } catch (e) {
      Log.alert(`Failed to update scores`)
      Log.error(e)
    }
    stopWatch.stop()

    stopWatch.start(`Recommended coins check`)
    try {
      new ScoreTrader(store, scores, TradeActions.default()).trade()
    } catch (e) {
      Log.alert(`Failed to trade recommended coins`)
      Log.error(e)
    }
    stopWatch.stop()

    stopWatch.start(`Anomalies check`)
    try {
      new AnomalyTrader(store, CacheProxy, priceProvider).trade()
    } catch (e) {
      Log.alert(`Failed to trade price anomalies`)
      Log.error(e)
    }
    stopWatch.stop()
  }
}
