import { type CoinName } from "./IPriceProvider";
import { type TradeMemo } from "./TradeMemo";
import { type PriceChannelData, type Stats } from "./Types";
import { type Config } from "./Config";

export type PriceChannelsDataResponse = Record<CoinName, PriceChannelData>;

export interface AppState {
  config: Config;
  assets: TradeMemo[];
  candidates: PriceChannelsDataResponse;
  info: Stats;
  firebaseURL: string;
}
