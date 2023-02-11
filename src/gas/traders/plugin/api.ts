import {
  type CoinName,
  type ExchangeSymbol,
  type MarketTrend,
  type PriceChannelData,
  type PriceHoldersMap,
  type PriceMap,
  type StableUSDCoin,
  type SymbolInfo,
} from "../../../lib/index";
import { type ChannelsDao } from "../../dao/Channels";

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
   * Signals to trade.
   */
  signals: Signal[];
}

export interface PluginContext {
  marketTrend: MarketTrend;
  prices: PriceHoldersMap;
  channelsDao: ChannelsDao;
  stableCoin: StableUSDCoin;
  /**
   * provideSignals - whether the plugin caller is interested in signals.
   */
  provideSignals: boolean;
  checkImbalance: boolean;
}

export interface Signal {
  coin: CoinName;
  type: SignalType;
  duration: number;
  rangeSize: number;
  imbalance: number;
}

export enum SignalType {
  Buy,
}
