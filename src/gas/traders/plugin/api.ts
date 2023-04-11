import {
  type CoinName,
  type ExchangeSymbol,
  type IChannelsDao,
  type PriceChannelData,
  type PriceHoldersMap,
  type PriceMap,
  type StableUSDCoin,
  type SymbolInfo,
} from "../../../lib/index";

export interface TraderPlugin {
  trade: (context: PluginContext) => PluginResult;
  getPrices: () => PriceMap;
  getCandidates: (dao: IChannelsDao) => Record<string, PriceChannelData>;
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
  stableCoin: StableUSDCoin;
  /**
   * provideSignals - whether the plugin caller is interested in signals.
   */
  provideSignals: number;
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
