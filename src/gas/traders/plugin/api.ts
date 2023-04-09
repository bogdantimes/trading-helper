import {
  type CoinName,
  type ExchangeSymbol,
  type PriceChannelData,
  type PriceHoldersMap,
  type PriceMap,
  type StableUSDCoin,
  type SymbolInfo,
} from "../../../lib/index";
import { type ChannelsDao } from "../../dao/Channels";

export interface TraderPlugin {
  trade: (context: {
    stableCoin: StableUSDCoin;
    dailyPrices: PriceHoldersMap;
    channelsDao: ChannelsDao;
    prices: PriceHoldersMap;
    provideSignals: number;
    I: number;
  }) => PluginResult;
  getPrices: () => PriceMap;
  getCandidates: (channelsDao: ChannelsDao) => Record<string, PriceChannelData>;
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
  prices: PriceHoldersMap;
  dailyPrices: PriceHoldersMap;
  channelsDao: ChannelsDao;
  stableCoin: StableUSDCoin;
  /**
   * provideSignals - whether the plugin caller is interested in signals.
   */
  provideSignals: number;
  I: number;
}

export interface Signal {
  coin: CoinName;
  type: SignalType;
  target: number;
}

export enum SignalType {
  None,
  Buy,
}
