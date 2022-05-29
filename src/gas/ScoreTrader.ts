import { IStore } from "./Store"
import { Scores } from "./Scores"
import { Log } from "./Common"
import { TradeActions } from "./TradeActions"
import { TradeState } from "../shared-lib/types"

export class ScoreTrader {
  private store: IStore
  private scores: Scores

  constructor(store: IStore, scores: Scores) {
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
      const recommended = this.scores.getRecommended().slice(0, tradeBestScores)

      // buy new coins from recommended list
      recommended
        .filter((cs) => !this.store.hasTrade(cs.coinName))
        .forEach((cs) => {
          Log.alert(`➕ Auto Trade Best Scores: ${cs.coinName} picked`)
          TradeActions.buy(cs.coinName)
        })

      // remove sold coins that are not in the recommended list
      this.store
        .getTradesList(TradeState.SOLD)
        .filter((tm) => !recommended.find((cs) => cs.coinName === tm.getCoinName()))
        .forEach((tm) => TradeActions.drop(tm.getCoinName()))
    }
  }
}
