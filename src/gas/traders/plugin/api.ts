import {
  CoinName,
  ExchangeSymbol,
  MarketTrend,
  PriceChannelData,
  PriceHoldersMap,
  PriceMap,
  StableUSDCoin,
  SymbolInfo,
} from "../../../lib/index";
import { ChannelsDao } from "../../dao/Channels";

export interface TraderPlugin {
  trade: (context: PluginContext) => PluginResult;
  getPrices: () => PriceMap;
  getCandidates: (
    channelsDao: ChannelsDao,
    percentile?: number
  ) => { [p: string]: PriceChannelData };
  getBinanceSymbolInfo: (symbol: ExchangeSymbol) => SymbolInfo;
}

export interface PluginResult {
  /**
   * Whether the current user has the access to advanced plugin features.
   */
  advancedAccess: boolean;
  /**
   * Requests to trade.
   */
  requests: TradeRequest[];
}

export interface PluginContext {
  marketTrend: MarketTrend;
  prices: PriceHoldersMap;
  channelsDao: ChannelsDao;
  stableCoin: StableUSDCoin;
  /**
   * provideCandidatesToBuy - whether the plugin caller is interested in buy candidates.
   */
  provideCandidatesToBuy: boolean;
}

export interface TradeRequest {
  coin: CoinName;
  action: TradeAction;
  x: number;
  y: number;
}

export enum TradeAction {
  Buy,
}
