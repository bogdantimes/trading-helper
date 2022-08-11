import { CoinName, Config } from "../../../lib/index";
import { ChannelsDao } from "../../dao/Channels";
import { PriceProvider } from "../../priceprovider/PriceProvider";

export interface TraderPlugin {
  trade: (context: TradingContext) => TradeRequest[];
}

export interface TradingContext {
  config: Config;
  priceProvider: PriceProvider;
  channelsDao: ChannelsDao;
}

export interface TradeRequest {
  coin: CoinName;
  action: TradeAction;
}

export enum TradeAction {
  Buy,
  Sell,
}
