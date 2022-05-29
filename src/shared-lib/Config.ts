import { AutoTradeBestScores, PriceProvider, StableUSDCoin } from "./types"

export type Config = {
  KEY?: string
  SECRET?: string
  StableCoin: StableUSDCoin
  BuyQuantity: number
  StopLimit: number
  /**
   * When ProfitBasedStopLimit is true - a stop limit for each asset is calculated based on the total profit of the tool.
   * All profit is divided equally between all assets and this amount is how much loss is allowed for each asset.
   * Such stop limits are always recalculated when the total profit or number of assets changes.
   * Overrides {@link StopLimit}.
   */
  ProfitBasedStopLimit: boolean
  ProfitLimit: number
  SellAtStopLimit: boolean
  SellAtProfitLimit: boolean
  SwingTradeEnabled: boolean
  PriceProvider: PriceProvider
  /**
   * When averaging down is enabled, all the money gained from selling is used to buy more your existing
   * most unprofitable (in percentage) asset.
   * If you have assets A, B (-10% loss) and C(-15% loss) and A is sold, the tool will buy more
   * of C, and C loss will be averaged down, for example to -7%.
   * Next time, if C turns profitable and is sold, the tool will buy more of B.
   * This way, **if the price decline is temporary** for all of your assets,
   * the tool will gradually sell all assets without loss.
   */
  AveragingDown: boolean
  /**
   * When price suddenly pumps or dumps for more than or equal percentage - an alert is sent.
   */
  PriceAnomalyAlert?: number
  /**
   * If true - buy the price dump automatically when {@link PriceAnomalyAlert} alert happens.
   */
  BuyDumps?: boolean
  /**
   * Sets the maximum percentage of all market currencies that should gain or lose price, to be
   * considered as those which scores have to be recalculated. For example:
   * if the value is 0.01, this means, that if 1% percent of all market currencies gain or lose price,
   * while 99% of all market currencies do not change or go in the opposite direction,
   * the scores will be recalculated for that 1%.
   */
  ScoreUpdateThreshold?: number
  /**
   * AutoTradeBestScores - when enabled, the tool will trade the "Scores" recommended coins automatically.
   * If the coin falls out of the recommended list, it will be removed from the assets once it is sold.
   */
  AutoTradeBestScores?: AutoTradeBestScores

  /**
   * @deprecated
   */
  PriceAsset?: string
  /**
   * @deprecated
   */
  TakeProfit?: number
  /**
   * @deprecated
   */
  LossLimit?: number
  /**
   * @deprecated
   */
  SellAtTakeProfit?: boolean
}
