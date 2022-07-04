import { IPriceProvider, IStore } from "../../../lib/index"
import { TradeActions } from "../../TradeActions"
import { ConfigDao } from "../../dao/Config"

export const PriceChannelDataKey = `ChannelData`

export interface TraderPlugin {
  trade(context: TradingContext): void
}

export interface TradingContext {
  store: IStore
  priceProvider: IPriceProvider
  configDao: ConfigDao
  tradeActions: TradeActions
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TradingResult {}
