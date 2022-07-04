import { CoinName } from "./IPriceProvider"
import { TradeMemo } from "./TradeMemo"
import { Coin, PriceChannelData } from "./Types"

export interface AssetsResponse {
  stableCoins: Coin[]
  trades: TradeMemo[]
}

export interface PriceChannelsDataResponse {
  [key: CoinName]: PriceChannelData
}
