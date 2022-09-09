import { CoinName } from "./IPriceProvider";
import { TradeMemo } from "./TradeMemo";
import { PriceChannelData } from "./Types";

export interface AssetsResponse {
  trades: TradeMemo[];
}

export interface PriceChannelsDataResponse {
  [key: CoinName]: PriceChannelData;
}
