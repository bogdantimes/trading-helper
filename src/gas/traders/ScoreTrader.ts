import { TradeActions } from "../TradeActions"
import { AutoTradeBestScores, CoinScore, TradeMemo, TradeState } from "../../lib"
import { Scores } from "../Scores"
import { TradesDao } from "../dao/Trades"
import { ConfigDao } from "../dao/Config"

export class ScoreTrader {
  private readonly configDao: ConfigDao
  private readonly scores: Scores
  private readonly tradesDao: TradesDao
  private readonly tradeActions: TradeActions

  constructor(
    configDap: ConfigDao,
    tradesDao: TradesDao,
    scores: Scores,
    tradeActions: TradeActions,
  ) {
    this.scores = scores
    this.configDao = configDap
    this.tradesDao = tradesDao
    this.tradeActions = tradeActions
  }

  /**
   * If {@link AutoTradeBestScores} is enabled, get recommended coins from scores and
   * if they are not already in the portfolio, buy them.
   * Coins that are sold and not in the recommended list are removed from the portfolio.
   */
  trade(): void {
    const config = this.configDao.get()
    const tradeBestScores = config.AutoTradeBestScores
    if (tradeBestScores > AutoTradeBestScores.OFF) {
      const scoresData = this.scores.get()

      const recommended = scoresData.recommended.slice(0, tradeBestScores)

      // buy new coins from recommended list
      recommended
        .filter((cs) => !this.tradesDao.has(cs.coinName))
        .forEach((cs) => this.tradeActions.buy(cs.coinName))

      // remove sold coins that are not in the recommended list
      this.tradesDao
        .getList(TradeState.SOLD)
        .filter((tm) => !this.isRecommended(recommended, tm))
        .forEach((tm) => this.tradeActions.drop(tm.getCoinName()))

      // cancel buying coins that are no longer in the recommended list
      this.tradesDao
        .getList(TradeState.BUY)
        .filter((tm) => !this.isRecommended(recommended, tm))
        .forEach((tm) => this.tradeActions.cancel(tm.getCoinName()))
    }
  }

  private isRecommended(recommended: CoinScore[], tm: TradeMemo) {
    return recommended.find((cs) => cs.coinName === tm.getCoinName())
  }
}
