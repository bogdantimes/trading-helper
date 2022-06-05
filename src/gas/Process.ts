import { DefaultTrader } from "./traders/DefaultTrader"
import { Exchange } from "./Exchange"
import { Statistics } from "./Statistics"
import { DeadlineError, DefaultStore, FirebaseStore } from "./Store"
import { Log } from "./Common"
import { ScoreTrader } from "./traders/ScoreTrader"
import { CacheProxy, DefaultCacheProxy } from "./CacheProxy"
import { IScores } from "./Scores"
import { PriceProvider } from "./PriceProvider"
import { AnomalyTrader } from "./traders/AnomalyTrader"

export class Process {
  static tick() {
    const exchange = new Exchange(DefaultStore.getConfig())
    const priceProvider = new PriceProvider(exchange, CacheProxy)
    const scores = global.TradingHelperScores.create(
      CacheProxy,
      DefaultStore,
      priceProvider,
    ) as IScores

    const scoreUpdateStart = Date.now()
    try {
      scores.update()
    } catch (e) {
      Log.alert(`Failed to update scores`)
      Log.error(e)
    }
    Log.debug(`Scores updated in ${Date.now() - scoreUpdateStart}ms`)

    const profiles = FirebaseStore.getProfiles()
    profiles.default = { name: `` }

    Object.values(profiles).forEach((profile) => {
      const profileTradesCheckStart = Date.now()

      const store = new FirebaseStore(profile)
      const cache = new DefaultCacheProxy(profile);
      const statistics = new Statistics(store)
      const trader = new DefaultTrader(store, cache, exchange, priceProvider, statistics)

      store.getTradesList().forEach((trade) => {
        try {
          store.changeTrade(trade.getCoinName(), (tm) => trader.tickerCheck(tm))
        } catch (e) {
          // send DeadlineError only to debug channel
          if (e.name === DeadlineError.name) {
            Log.debug(e)
          } else {
            Log.error(e)
          }
        }
      })
      Log.debug(`Profile ${profile.name} trades checked in ${Date.now() - profileTradesCheckStart}ms`)

      const profileStableCoinCheckStart = Date.now()
      try {
        trader.updateStableCoinsBalance()
      } catch (e) {
        Log.alert(`Failed to read stable coins balance`)
        Log.error(e)
      }
      Log.debug(`Profile ${profile.name} stable coins checked in ${Date.now() - profileStableCoinCheckStart}ms`)


      const profileScoresTradesStart = Date.now()
      try {
        new ScoreTrader(store, scores).trade()
      } catch (e) {
        Log.alert(`Failed to trade recommended coins`)
        Log.error(e)
      }
      Log.debug(`Profile ${profile.name} scores checked in ${Date.now() - profileScoresTradesStart}ms`)

      const profileAnomalyTradesStart = Date.now()
      try {
        new AnomalyTrader(store, cache, priceProvider).trade()
      } catch (e) {
        Log.alert(`Failed to trade price anomalies`)
        Log.error(e)
      }
      Log.debug(`Profile ${profile.name} anomaly trades checked in ${Date.now() - profileAnomalyTradesStart}ms`)

      store.dumpChanges()
    })
  }
}
