import { V2Trader } from "./Trader"
import { Exchange } from "./Exchange"
import { Statistics } from "./Statistics"
import { DeadlineError, DefaultStore } from "./Store"
import { Scores } from "./Scores"
import { Log } from "./Common"
import { ScoreTrader } from "./ScoreTrader"

export class Process {
  static tick() {
    const store = DefaultStore
    const exchange = new Exchange(store.getConfig())
    const trader = new V2Trader(store, exchange, new Statistics(store))
    const scores = new Scores(store, exchange)

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

    store.dumpChanges()
  }
}
