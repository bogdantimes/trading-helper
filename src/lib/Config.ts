import { type StableUSDCoin } from "./Types";

export type AutoDetect = -1;

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
   * @deprecated in favor of SmartExit
   */
  SellAtStopLimit?: boolean | undefined;
  SmartExit: boolean;
  /**
   * Whether the current app has the access to advanced plugin features.
   */
  AdvancedAccess: boolean;
  ViewOnly: boolean;
  HideBalances: boolean;
  BudgetSplitMin: number;
  MarketStrengthTargets: { min: number; max: number };
  TradingAutoStopped?: boolean;
  BullRunEndTime?: number;
  /**
   * When enabled - the system simulates bying and selling, without actually doing that on the exchange.
   * It also does not check if the stable coin balance is real or not.
   */
  DryRun?: boolean;
}

export const MASK = `********`;
export const SHORT_MASK = `****`;
export const BNB = `BNB`;
export const BNBFee = 0.00075;
export const StandardFee = 0.001;
export const MIN_BUY = 15;
export const AUTO_DETECT: AutoDetect = -1;
export const MINIMUM_FEE_COVERAGE = 3;
export const TARGET_FEE_COVERAGE = 10;
export const DEFAULT_WAIT_LOCK = 2000;
export const BULL_RUN_THRESHOLD_REDUCE = 0.0;
