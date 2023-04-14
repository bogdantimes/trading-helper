import Integer = GoogleAppsScript.Integer;
import { enumKeys } from "./Functions";
import { type CoinName } from "./IPriceProvider";

export enum StableUSDCoin {
  USDT = `USDT`,
  BUSD = `BUSD`, // TODO: remove once it dies out
}

export enum OtherStableCoins {
  TUSD = `TUSD`,
  AUD = `AUD`,
  GBP = `GBP`,
  USDP = `USDP`,
  EUR = `EUR`,
  USDC = `USDC`,
}

export type PriceMap = Record<string, number>;

export interface Stats {
  TotalProfit: number;
  TotalWithdrawals: number;
  DailyProfit: PriceMap;
}

export class ExchangeSymbol {
  readonly quantityAsset: string;
  readonly priceAsset: string;

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

export interface IStore {
  get: (key: string) => any;

  getKeys: () => string[];

  set: (key: string, value: any) => any;

  delete: (key: string) => void;

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
  TREND,
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
  [Key.ATH]: number;
  [Key.ATHTime]: number;
  [Key.IMBALANCE]?: number;
  [Key.TREND]?: string;
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

export interface SymbolInfo {
  symbol: string;
  filters: Filter[];
}

export interface ExchangeInfo {
  symbols: SymbolInfo[];
}

export interface ICandidatesDao {
  getAll: () => Record<string, CandidateInfo>;
  get: (coin: CoinName) => CandidateInfo;
  set: (coin: Coin, data: CandidateInfo) => void;
  setAll: (data: Record<string, CandidateInfo>) => void;
  delete: (coin: Coin) => void;
}

export class StableCoinMatcher {
  private readonly symbol: string;
  private readonly match: RegExpMatchArray | null;

  constructor(symbol: string) {
    this.symbol = symbol.toUpperCase();
    this.match = this.symbol.match(
      new RegExp(`^(\\w+)(${enumKeys(StableUSDCoin).join(`|`)})$`)
    );
  }

  get coinName(): CoinName | null {
    return this.match ? this.match[1] : null;
  }

  get stableCoin(): StableUSDCoin | null {
    return this.match ? (this.match[2] as StableUSDCoin) : null;
  }
}
