import Integer = GoogleAppsScript.Integer;
import { enumKeys } from "./Functions";
import { type CoinName } from "./IPriceProvider";

export enum StableUSDCoin {
  USDT = `USDT`,
}

export enum OtherStableCoins {
  USDC = `USDC`,
  DAI = `DAI`,
  TUSD = `TUSD`,
  BUSD = `BUSD`,
  USDD = `USDD`,
  FRAX = `FRAX`,
  USDP = `USDP`,
  FDUSD = `FDUSD`,
  USDJ = `USDJ`,
}

export type PriceMap = Record<string, number>;

type DateString = string;
type ProfitValue = number;

export interface Stats {
  TotalProfit: number;
  TotalWithdrawals: number;
  DailyProfit: Record<DateString, ProfitValue>;
}

const reversed = Symbol(`reversed`);

export class ExchangeSymbol {
  quantityAsset: string;
  priceAsset: string;
  private [reversed] = false;

  constructor(coinName: string, priceAsset: string) {
    if (!coinName) {
      throw Error(`Invalid quantityAsset: "${coinName}"`);
    }
    if (!priceAsset) {
      throw Error(`Invalid priceAsset: "${priceAsset}"`);
    }
    this.quantityAsset = coinName.toUpperCase();
    this.priceAsset = priceAsset.toUpperCase();
  }

  static fromObject(object: {
    quantityAsset: string;
    priceAsset: string;
  }): ExchangeSymbol {
    return new ExchangeSymbol(object.quantityAsset, object.priceAsset);
  }

  toString(): string {
    return this.quantityAsset + this.priceAsset;
  }

  reverseThis(): this {
    const pa = this.priceAsset;
    this.priceAsset = this.quantityAsset;
    this.quantityAsset = pa;
    this[reversed] = !this[reversed];
    return this;
  }

  isReversed(): boolean {
    return this[reversed];
  }
}

export enum TradeState {
  BUY = `buy`,
  BOUGHT = `bought`,
  SELL = `sell`,
  SOLD = `sold`,
  NONE = `none`,
}

export class Coin {
  readonly name: string;
  readonly balance: number;

  constructor(name: string, balance = 0) {
    if (!name) throw new Error(`Invalid coin name: "${name}"`);
    this.name = name.toUpperCase();
    this.balance = Math.max(balance, 0);
  }

  isStable(): boolean {
    return Object.keys(StableUSDCoin).includes(this.name);
  }
}

export enum PriceMove {
  STRONG_DOWN,
  DOWN,
  NEUTRAL,
  UP,
  STRONG_UP,
}

export interface InitialSetupParams {
  dbURL: string;
  binanceAPIKey?: string;
  binanceSecretKey?: string;
  viewOnly: boolean;
}

export interface ICacheProxy {
  get: (key: string) => string | null;
  put: (key: string, value: string, expirationInSeconds?: Integer) => void;
  remove: (key: string) => void;
}

export const StoreNoOp = Symbol(`StoreNoOp`);
export const StoreDeleteProp = Symbol(`StoreDeleteProp`);

export interface IStore {
  get: <T>(key: string) => T | undefined;

  getKeys: () => string[];

  update: <T>(key: string, mutateFn: (v: T) => T | symbol) => T | undefined;

  isConnected: () => boolean;

  connect: (dbURL: string) => void;

  keepCacheAlive: () => void;

  clearCache: () => void;
}

export enum Key {
  DURATION,
  MIN,
  MAX,
  S0,
  S1,
  S2,
  SIZE,
  PERCENTILE,
  DURATION_MET,
  MAX_PERCENTILE,
  PRICE_MOVE,
  MIN_PERCENTILE,
  STRENGTH,
  ATH,
  ATHTime,
  IMBALANCE,
  /**
   * @deprecated
   */
  IS_READY,
  MID,
  /**
   * @deprecated
   */
  TREND,
  DAY_PRICE_MOVE,
  REFRESH,
  PINNED,
}

export enum Bit {
  FALSE,
  TRUE,
}

export enum ChannelState {
  NONE,
  BOTTOM,
  MIDDLE,
  TOP,
}

export interface CandidateInfo {
  [Key.DURATION]: number;
  [Key.DURATION_MET]: Bit;
  [Key.MIN]: number;
  [Key.MID]: number;
  [Key.MAX]: number;
  [Key.SIZE]: number;
  [Key.S0]: ChannelState;
  [Key.S1]: ChannelState;
  [Key.S2]: ChannelState;
  [Key.PERCENTILE]: number;
  [Key.MAX_PERCENTILE]: number;
  [Key.MIN_PERCENTILE]: number;
  [Key.PRICE_MOVE]: PriceMove;
  [Key.STRENGTH]: number;
  [Key.IMBALANCE]?: number;
  [Key.ATH]: number;
  [Key.ATHTime]: number;
  [Key.DAY_PRICE_MOVE]: number;
  [Key.REFRESH]: Bit;
  [Key.PINNED]: Bit;
}

export interface Candidates {
  selected: Record<string, CandidateInfo>;
  all: Record<string, CandidateInfo>;
}

export interface UpgradeInfo {
  newVersion?: string;
  URL?: string;
  files?: Array<{ id?: string; name: string; type: string; source: string }>;
}

export type StableCoinKeys = keyof typeof StableUSDCoin;

export interface Filter {
  filterType: `LOT_SIZE` | `PRICE_FILTER`;
  stepSize?: string;
  tickSize?: string;
}

export enum SymbolStatus {
  TRADING = `TRADING`,
}

export interface SymbolInfo {
  symbol: string;
  filters: Filter[];
  status: SymbolStatus;
  precision: number;
}

export interface ExchangeInfo {
  symbols: SymbolInfo[];
}

export interface ICandidatesDao {
  getAll: () => Record<string, CandidateInfo>;
  get: (coin: CoinName) => CandidateInfo;
  update: (
    mutateFn: (
      data: Record<string, CandidateInfo>,
    ) => Record<string, CandidateInfo>,
  ) => void;
  getAverageImbalance: (recs?: Record<string, CandidateInfo>) => {
    average: number;
    accuracy: number;
  };
}

export interface MarketData {
  demandHistory: number[];
  lastHistoryUpdate: number;
}

export interface IMarketDataDao {
  get: () => MarketData;
  getStrength: (currentDemand: number) => number;
  updateDemandHistory: (
    getDemand: () => { accuracy: number; average: number },
    step: number,
  ) => boolean;
}

export class StableCoinMatcher {
  private readonly symbol: string;
  private readonly match: RegExpMatchArray | null;

  constructor(symbol: string) {
    this.symbol = symbol.toUpperCase();
    this.match = this.symbol.match(
      new RegExp(`^(\\w+)(${enumKeys(StableUSDCoin).join(`|`)})$`),
    );
  }

  get coinName(): CoinName | null {
    return this.match ? this.match[1] : null;
  }

  get stableCoin(): StableUSDCoin | null {
    return this.match ? (this.match[2] as StableUSDCoin) : null;
  }
}
