import { StableUSDCoin } from "./Types";

export interface Config {
  KEY?: string;
  SECRET?: string;
  StableCoin: StableUSDCoin;
  /**
   * Balance of free money. If set to -1, means it should be initialized by reading from the account.
   * Otherwise, if it is >= 0, it tells the program how much money it has and can use.
   */
  StableBalance: number;
  /**
   * InvestRatio specifies the max number of coins/tokens to invest into.
   * Available money are split proportionally.
   */
  InvestRatio: number;
  /**
   * FearGreedIndex equal to 1 is better for a bullish market
   * (makes profit goal higher and allow to hold an asset for longer),
   * while 2 and 3, make it better for consolidation or bearish market accordingly.
   */
  FearGreedIndex: number;
  /**
   * ChannelSize - defines the percentage between the upper and lower bounds of a price channel.
   */
  ChannelSize: number;
  /**
   * ChannelWindowMins - defines the number of minutes that the price must be in the channel before
   * it breaks out of the channel and an anomaly event is sent.
   */
  ChannelWindowMins: number;

  SellAtStopLimit: boolean;
}
