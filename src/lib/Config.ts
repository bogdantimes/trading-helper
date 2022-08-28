import { StableUSDCoin } from "./Types";

export interface Config {
  KEY?: string;
  SECRET?: string;
  StableCoin: StableUSDCoin;
  StableBalance: number;
  /**
   * InvestRatio when provided overrides the BuyQuantity and instead invests according to the ratio.
   * BuyQuantity in this case is calculated as Math.floor(freeAsset/InvestRatio),
   * but not less than DefaultConfig.BuyQuantity.
   */
  InvestRatio?: number;
  ProfitLimit: number;
  SellAtStopLimit: boolean;
  /**
   * ChannelSize - defines the percentage between the upper and lower bounds of a price channel.
   */
  ChannelSize: number;
  /**
   * ChannelWindowMins - defines the number of minutes that the price must be in the channel before
   * it breaks out of the channel and an anomaly event is sent.
   */
  ChannelWindowMins: number;
}
