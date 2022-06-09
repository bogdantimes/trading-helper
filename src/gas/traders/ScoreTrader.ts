import { TradeActions } from "../TradeActions"
import { CoinScore, Config, ICacheProxy, TradeMemo, TradeState } from "trading-helper-lib"
import { IScores } from "../Scores"
import { AssetsDao } from "../dao/Assets"
import { CacheProxy } from "../CacheProxy"
import { IStore } from "../Store"
import { ConfigDao } from "../dao/Config"

export class ScoreTrader {
  private readonly config: Config
  private readonly scores: IScores
  private readonly assetsDao: AssetsDao

  constructor(store: IStore, cache: ICacheProxy, scores: IScores) {
    this.scores = scores
    this.config = new ConfigDao(store, cache).get()
    this.assetsDao = new AssetsDao(store, CacheProxy)
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
      const tradeActions = TradeActions.default()
      recommended
        .filter((cs) => !this.assetsDao.has(cs.coinName))
        .forEach((cs) => tradeActions.buy(cs.coinName))

      // remove sold coins that are not in the recommended list
      this.assetsDao
        .getList(TradeState.SOLD)
        .filter((tm) => !this.isRecommended(recommended, tm))
        .forEach((tm) => tradeActions.drop(tm.getCoinName()))

      // cancel buying coins that are no longer in the recommended list
      this.assetsDao
        .getList(TradeState.BUY)
        .filter((tm) => !this.isRecommended(recommended, tm))
        .forEach((tm) => tradeActions.cancel(tm.getCoinName()))
    }
  }

  private isRecommended(recommended: CoinScore[], tm: TradeMemo) {
    return recommended.find((cs) => cs.coinName === tm.getCoinName())
  }
}
