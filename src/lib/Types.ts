import Integer = GoogleAppsScript.Integer;

export enum StableUSDCoin {
  BUSD = `BUSD`,
  USDT = `USDT`,
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
  DailyProfit: PriceMap;
}

export class ExchangeSymbol {
  readonly quantityAsset: string;
  readonly priceAsset: string;

  constructor(quantityAsset: string, priceAsset: string) {
    if (!quantityAsset) {
      throw Error(`Invalid quantityAsset: "${quantityAsset}"`);
    }
    if (!priceAsset) {
      throw Error(`Invalid priceAsset: "${priceAsset}"`);
    }
    this.quantityAsset = quantityAsset.toUpperCase();
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

export interface MarketMove {
  [PriceMove.STRONG_DOWN]: number;
  [PriceMove.DOWN]: number;
  [PriceMove.NEUTRAL]: number;
  [PriceMove.UP]: number;
  [PriceMove.STRONG_UP]: number;
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

export enum PriceAction {
  NONE,
  DOUBLE_TOP,
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
  IS_READY,
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

export interface PriceChannelData {
  [Key.DURATION]: number;
  [Key.DURATION_MET]: Bit;
  [Key.MIN]: number;
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
  [Key.IMBALANCE]: number;
  [Key.IS_READY]: Bit;
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
