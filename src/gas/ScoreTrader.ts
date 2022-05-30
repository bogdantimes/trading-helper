import { IStore } from "./Store"
import { Log } from "./Common"
import { TradeActions } from "./TradeActions"
import { AutoTradeBestScores, CoinScore, TradeMemo, TradeState } from "trading-helper-lib"
import { IScores } from "./Scores"

export class ScoreTrader {
  private store: IStore
  private scores: IScores

  constructor(store: IStore, scores: IScores) {
    this.store = store
    this.scores = scores
  }

  /**
   * If {@link AutoTradeBestScores} is enabled, get recommended coins from scores and
   * if they are not already in the portfolio, buy them.
   * Coins that are sold and not in the recommended list are removed from the portfolio.
   */
  trade(): void {
    const tradeBestScores = this.store.getConfig().AutoTradeBestScores
    if (tradeBestScores) {
      const scoresData = this.scores.get()
      if (!scoresData.realData) return

      const recommended = scoresData.recommended.slice(0, tradeBestScores)

      // buy new coins from recommended list
      recommended
        .filter((cs) => !this.store.hasTrade(cs.coinName))
        .forEach((cs) => {
          Log.alert(`➕ Auto-buying ${AutoTradeBestScores[tradeBestScores]}: ${cs.coinName}`)
          TradeActions.buy(cs.coinName)
        })

      // sell coins that have non-zero profit, non-HODL, and are not in the recommended list
      this.store.getTradesList(TradeState.BOUGHT).forEach((tm) => {
        if (tm.hodl) return

        if (tm.profit() > 0 && !this.isRecommended(recommended, tm)) {
          TradeActions.sell(tm.getCoinName())
        }
      })

      // remove sold coins that are not in the recommended list
      this.store
        .getTradesList(TradeState.SOLD)
        .filter((tm) => !this.isRecommended(recommended, tm))
        .forEach((tm) => TradeActions.drop(tm.getCoinName()))

      // cancel buying coins that are no longer in the recommended list
      this.store
        .getTradesList(TradeState.BUY)
        .filter((tm) => !this.isRecommended(recommended, tm))
        .forEach((tm) => TradeActions.cancel(tm.getCoinName()))
    }
  }

  private isRecommended(recommended: CoinScore[], tm: TradeMemo) {
    return recommended.find((cs) => cs.coinName === tm.getCoinName())
  }
}
