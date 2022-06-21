import { DefaultTrader } from "./traders/DefaultTrader"
import { Exchange } from "./Exchange"
import { Statistics } from "./Statistics"
import { DefaultProfileStore, FirebaseStore } from "./Store"
import { Log } from "./Common"
import { ScoreTrader } from "./traders/ScoreTrader"
import { CacheProxy, DefaultProfileCacheProxy } from "./CacheProxy"
import { IScores } from "./Scores"
import { PriceProvider } from "./PriceProvider"
import { AnomalyTrader } from "./traders/AnomalyTrader"

export class Process {
  static tick() {
    const exchange = new Exchange(DefaultProfileStore.getConfig())
    const priceProvider = PriceProvider.getInstance(exchange, DefaultProfileCacheProxy)

    // Update prices every tick. This should the only place to call `update` on the price provider.
    priceProvider.update()

    const scores = global.TradingHelperScores.create(
      DefaultProfileCacheProxy,
      DefaultProfileStore,
      priceProvider,
    ) as IScores

    try {
      scores.update()
    } catch (e) {
      Log.alert(`Failed to update scores`)
      Log.error(e)
    }

    const profiles = FirebaseStore.getProfiles()

    Object.values(profiles).forEach((profile) => {
      const store = new FirebaseStore(profile)
      const cache = new CacheProxy(profile)
      const statistics = new Statistics(store)
      const trader = new DefaultTrader(store, cache, exchange, priceProvider, statistics)
      Log.setPrefix(`[${profile.name}]`)

      store.getTradesList().forEach((trade) => {
        try {
          store.changeTrade(trade.getCoinName(), (tm) => trader.tickerCheck(tm))
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
        // TODO: creating scores with profile store to get recommended for profile
        const profileScores = global.TradingHelperScores.create(
          DefaultProfileCacheProxy,
          store,
          priceProvider,
        ) as IScores
        new ScoreTrader(store, profileScores).trade()
      } catch (e) {
        Log.alert(`Failed to trade recommended coins`)
        Log.error(e)
      }

      try {
        new AnomalyTrader(store, cache, priceProvider).trade()
      } catch (e) {
        Log.alert(`Failed to trade price anomalies`)
        Log.error(e)
      }

      store.dumpChanges()
    })

    Log.setPrefix(``)
  }
}
