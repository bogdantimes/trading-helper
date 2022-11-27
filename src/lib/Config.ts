import { StableUSDCoin } from "./Types";

export type AutoDetect = -1;
export enum MarketTrend {
  DOWN = 1,
  SIDEWAYS = 2,
  UP = 3,
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
   * MarketTrend affects the profit goal and the stop limit aggressiveness.
   * For mark-up trend, it makes the profit goal lower and the stop limit more aggressive.
   * This allows to trade shorter and save profit when the market suddenly turns down.
   * Mark-down is the opposite: higher profit goal and less aggressive stop limit.
   * Set to -1 to auto-detect the market trend.
   */
  MarketTrend: AutoDetect | MarketTrend;
  AutoMarketTrend: MarketTrend;
  SellAtStopLimit: boolean;
  /**
   * Whether the current app has the access to advanced plugin features.
   */
  AdvancedAccess: boolean;
  ViewOnly: boolean;
  HideBalances: boolean;
  ImbalanceCheck: boolean;
}

export const DefaultRange = 0.14;
export const DefaultDuration = 4000;
export const MASK = `********`;
export const SHORT_MASK = `👻`;
