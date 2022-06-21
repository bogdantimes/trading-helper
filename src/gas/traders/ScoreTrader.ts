import { TradeActions } from "../TradeActions"
import { CoinScore, Config, ICacheProxy, TradeMemo, TradeState } from "trading-helper-lib"
import { IScores } from "../Scores"
import { TradesDao } from "../dao/Trades"
import { IStore } from "../Store"
import { ConfigDao } from "../dao/Config"

export class ScoreTrader {
  private readonly config: Config
  private readonly scores: IScores
  private readonly tradesDao: TradesDao
  private readonly tradeActions: TradeActions

  constructor(store: IStore, scores: IScores, tradeActions: TradeActions) {
    this.scores = scores
    this.config = new ConfigDao(store).get()
    this.tradesDao = new TradesDao(store)
    this.tradeActions = tradeActions
  }

  /**
   * If {@link AutoTradeBestScores} is enabled, get recommended coins from scores and
   * if they are not already in the portfolio, buy them.
   * Coins that are sold and not in the recommended list are removed from the portfolio.
   */
  trade(): void {
    const tradeBestScores = this.config.AutoTradeBestScores
    if (tradeBestScores) {
      const scoresData = this.scores.get()
      if (!scoresData.realData) return

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
