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

export interface PriceMap {
  [key: string]: number;
}

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
  binanceAPIKey: string;
  binanceSecretKey: string;
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

  getOrSet: (key: string, value: any) => any;

  delete: (key: string) => void;

  isConnected: () => boolean;

  connect: (dbURL: string) => void;
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
  [Key.PRICE_MOVE]: PriceMove;
}
