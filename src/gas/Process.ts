import { DefaultTrader } from "./traders/DefaultTrader"
import { Exchange } from "./Exchange"
import { Statistics } from "./Statistics"
import { DefaultStore } from "./Store"
import { Log } from "./Common"
import { ScoreTrader } from "./traders/ScoreTrader"
import { CacheProxy } from "./CacheProxy"
import { IScores } from "./Scores"
import { PriceProvider } from "./PriceProvider"
import { AnomalyTrader } from "./traders/AnomalyTrader"
import { TradesDao } from "./dao/Trades"
import { ConfigDao } from "./dao/Config"

export class Process {
  static tick() {
    const store = DefaultStore
    const tradesDao = new TradesDao(store)
    const configDao = new ConfigDao(store)

    const config = configDao.get()
    const exchange = new Exchange(config)
    const statistics = new Statistics(store)
    const priceProvider = PriceProvider.getInstance(exchange, CacheProxy)

    // Update prices every tick. This should the only place to call `update` on the price provider.
    priceProvider.update()

    const trader = new DefaultTrader(store, CacheProxy, exchange, priceProvider, statistics)
    const scores = global.TradingHelperScores.create(DefaultStore, priceProvider, config) as IScores

    tradesDao.getList().forEach((trade) => {
      try {
        tradesDao.update(trade.getCoinName(), (tm) => trader.tickerCheck(tm))
      } catch (e) {
        Log.error(e)
      }
    })

    try {
      trader.updateStableCoinsBalance()
    } catch (e) {
      Log.alert(`Failed to read stable coins balance`)
      Log.error(e)
    }

    try {
      scores.update()
    } catch (e) {
      Log.alert(`Failed to update scores`)
      Log.error(e)
    }

    try {
      new ScoreTrader(store, CacheProxy, scores).trade()
    } catch (e) {
      Log.alert(`Failed to trade recommended coins`)
      Log.error(e)
    }

    try {
      new AnomalyTrader(store, CacheProxy, priceProvider).trade()
    } catch (e) {
      Log.alert(`Failed to trade price anomalies`)
      Log.error(e)
    }
  }
}
