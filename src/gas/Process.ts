import { DefaultTrader } from "./traders/DefaultTrader"
import { Exchange } from "./Exchange"
import { Statistics } from "./Statistics"
import { DeadlineError, DefaultStore } from "./Store"
import { Log } from "./Common"
import { ScoreTrader } from "./traders/ScoreTrader"
import { CacheProxy } from "./CacheProxy"
import { IScores } from "./Scores"
import { PriceProvider } from "./PriceProvider"
import { AnomalyTrader } from "./traders/AnomalyTrader"

export class Process {
  static tick() {
    const store = DefaultStore
    const config = store.getConfig()
    const exchange = new Exchange(config)
    const statistics = new Statistics(store)
    const priceProvider = new PriceProvider(exchange, CacheProxy)
    const trader = new DefaultTrader(store, exchange, priceProvider, statistics)
    const scores = global.TradingHelperScores.create(CacheProxy, DefaultStore, priceProvider) as IScores

    store.getTradesList().forEach((trade) => {
      try {
        DefaultStore.changeTrade(trade.getCoinName(), (tm) => trader.tickerCheck(tm))
      } catch (e) {
        // send DeadlineError only to debug channel
        if (e.name === DeadlineError.name) {
          Log.debug(e)
        } else {
          Log.error(e)
        }
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
      new ScoreTrader(store, scores).trade()
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

    store.dumpChanges()
  }
}
