import {
  type CandidateInfo,
  type Candidates,
  type CoinName,
  type ExchangeSymbol,
  type ICandidatesDao,
  type PriceHoldersMap,
  type PriceMap,
  type StableUSDCoin,
  type SymbolInfo,
} from "../../../lib/index";

export interface TraderPlugin {
  trade: (context: PluginContext) => PluginResult;
  getPrices: () => PriceMap;
  getCandidates: (dao: ICandidatesDao) => Candidates;
  getOptimalInvestRatio: (dao: ICandidatesDao) => number;
  getBinanceSymbolInfo: (symbol: ExchangeSymbol) => SymbolInfo | undefined;
  getImbalance: (coin: CoinName, c: CandidateInfo) => number;
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
  candidatesDao: ICandidatesDao;
  stableCoin: StableUSDCoin;
  /**
   * provideSignals - whether the plugin caller is interested in signals.
   */
  provideSignals: number;
  /**
   * Step number (used only for back-testing)
   */
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
