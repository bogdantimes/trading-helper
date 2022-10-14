import { CoinName } from "./IPriceProvider";
import { TradeMemo } from "./TradeMemo";
import { PriceChannelData, Stats } from "./Types";
import { Config } from "./Config";

export interface PriceChannelsDataResponse {
  [key: CoinName]: PriceChannelData;
}

export interface AppState {
  config: Config | null;
  assets: TradeMemo[];
  candidates: PriceChannelsDataResponse;
  info: Stats;
  firebaseURL: string;
}
