import { CoinName } from "./IPriceProvider";
import { TradeMemo } from "./TradeMemo";
import { PriceChannelData, Stats } from "./Types";
import { Config } from "./Config";

export type PriceChannelsDataResponse = Record<CoinName, PriceChannelData>;

export interface AppState {
  config: Config;
  assets: TradeMemo[];
  candidates: PriceChannelsDataResponse;
  info: Stats;
  firebaseURL: string;
}
