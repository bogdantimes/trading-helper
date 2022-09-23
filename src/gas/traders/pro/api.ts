import { CoinName, MarketTrend, PriceHoldersMap } from "../../../lib/index";
import { ChannelsDao } from "../../dao/Channels";

export interface TraderPlugin {
  trade: (context: PluginContext) => TradeRequest[];
}

export interface PluginContext {
  marketTrend: MarketTrend;
  prices: PriceHoldersMap;
  channelsDao: ChannelsDao;
}

export interface TradeRequest {
  coin: CoinName;
  action: TradeAction;
  x: number;
  y: number;
}

export enum TradeAction {
  Buy,
  Sell,
}
