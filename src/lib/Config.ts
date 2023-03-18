import { type StableUSDCoin } from "./Types";

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
   * Balance of free money. If set to AUTO_DETECT, means it should be initialized by reading from the account.
   * Otherwise, if it is >= 0, it tells the program how much money it has and can use.
   */
  StableBalance: number | AutoDetect;
  /**
   * FeesBudget is total value of account's BNB in the StableCoin value.
   */
  FeesBudget: number;
  AutoReplenishFees: boolean;
  /**
   * MarketTrend affects the profit goal and the stop limit aggressiveness.
   * For mark-up trend, it makes the profit goal lower and the stop limit more aggressive.
   * This allows to trade shorter and save profit when the market suddenly turns down.
   * Mark-down is the opposite: higher profit goal and less aggressive stop limit.
   * Set to AUTO_DETECT to auto-detect the market trend.
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
  EntryImbalanceCheck: boolean;
}

export const DefaultRange = 0.14;
export const DefaultDuration = 4000;
export const MASK = `********`;
export const SHORT_MASK = `👻`;
export const BNB = `BNB`;
export const BNBFee = 0.00075;
export const MIN_BUY = 15;
export const AUTO_DETECT: AutoDetect = -1;
export const MINIMUM_FEE_COVERAGE = 3;
export const TARGET_FEE_COVERAGE = 10;
