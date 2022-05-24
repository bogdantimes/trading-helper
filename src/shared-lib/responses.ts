import { TradeMemo } from "./TradeMemo"
import { Coin } from "./types"

export type AssetsResponse = {
  stableCoins: Coin[]
  trades: TradeMemo[]
}
