import { StableUSDCoin } from "./Types";

export type AUTO_FGI = -1;
export enum FGI {
  BEARISH = 1,
  NEUTRAL = 2,
  BULLISH = 3,
}

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
   * FearGreedIndex affects the profit goal and the stop limit aggressiveness.
   * For bullish market, it makes the profit goal lower and the stop limit more aggressive.
   * This allows to trade shorter and save profit when the market suddenly turns down.
   * Bearish market is the opposite: higher profit goal and less aggressive stop limit.
   * Set to -1 to auto-detect the market trend.
   */
  FearGreedIndex: AUTO_FGI | FGI;
  AutoFGI: FGI;
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
