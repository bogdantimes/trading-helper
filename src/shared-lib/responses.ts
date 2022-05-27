import { TradeMemo } from "./TradeMemo"
import { Coin, MarketMove } from "./types"
import { CoinScore } from "./CoinScore"

export type AssetsResponse = {
  stableCoins: Coin[]
  trades: TradeMemo[]
}

export type ScoresResponse = {
  coins: CoinScore[]
  marketMove: MarketMove
}
