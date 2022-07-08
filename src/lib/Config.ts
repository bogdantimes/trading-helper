import { PriceProvider, StableUSDCoin } from "./Types"

export interface Config {
  KEY?: string
  SECRET?: string
  StableCoin: StableUSDCoin
  BuyQuantity: number
  /**
   * InvestRatio when provided overrides the BuyQuantity and instead invests according to the ratio.
   * BuyQuantity in this case is calculated as Math.floor(freeAsset/InvestRatio),
   * but not less than DefaultConfig.BuyQuantity.
   */
  InvestRatio?: number
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
   * If true - sell the price pump automatically when {@link PriceAnomalyAlert} alert happens.
   */
  SellPumps?: boolean
  /**
   * ChannelSize - defines the percentage between the upper and lower bounds of a price channel.
   */
  ChannelSize: number
  /**
   * ChannelWindowMins - defines the number of minutes that the price must be in the channel before
   * it breaks out of the channel and an anomaly event is sent.
   */
  ChannelWindowMins: number

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
