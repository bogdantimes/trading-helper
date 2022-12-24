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
  ) => Record<string, PriceChannelData>;
  getBinanceSymbolInfo: (symbol: ExchangeSymbol) => SymbolInfo | undefined;
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
  duration: number;
  rangeSize: number;
}

export enum TradeAction {
  Buy,
}
