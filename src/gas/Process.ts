import { V2Trader } from "./Trader"
import { Exchange } from "./Exchange"
import { Statistics } from "./Statistics"
import { DefaultStore } from "./Store"
import { Survivors } from "./Survivors"
import { Log } from "./Common"

export class Process {
  static tick() {
    const store = DefaultStore

    const exchange = new Exchange(store.getConfig())
    const trader = new V2Trader(store, exchange, new Statistics(store))

    store.getTradesList().forEach((trade) => {
      try {
        DefaultStore.changeTrade(trade.getCoinName(), (tm) => trader.tickerCheck(tm))
      } catch (e) {
        Log.error(e)
      }
    })

    try {
      trader.updateStableCoinsBalance()
    } catch (e) {
      Log.error(new Error(`Failed to read stable coins balance: ${e.message}`))
    }

    store.dumpChanges()

    try {
      new Survivors(store, exchange).updateScores()
    } catch (e) {
      Log.info(e)
    }
  }
}
