import { CoinName, FGI, PriceHoldersMap } from "../../../lib/index";
import { ChannelsDao } from "../../dao/Channels";

export interface TraderPlugin {
  trade: (context: TradingContext) => TradeRequest[];
}

export interface TradingContext {
  FGI: FGI;
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
