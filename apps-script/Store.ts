import {TradeMemo} from "./TradeMemo";

export interface IStore {
  get(key: String): any

  getKeys(): string[]

  set(key: String, value: any): any

  getConfig(): Config

  setConfig(config: Config): void

  getOrSet(key: String, value: any): any

  increment(key: String): number

  delete(key: String)

  getTrades(): { [key: string]: TradeMemo }

  getTradesList(): TradeMemo[]

  getTrade(symbol: ExchangeSymbol): TradeMemo

  setTrade(tradeMemo: TradeMemo): void

  deleteTrade(tradeMemo: TradeMemo): void

  dumpChanges(): void
}

export class FirebaseStore implements IStore {
  private readonly source: object
  private tradesCache: { [key: string]: TradeMemo }
  private configCache: Config;

  constructor() {
    const url = PropertiesService.getScriptProperties().getProperty("FB_URL")
    if (!url) {
      throw Error("Firebase URL key 'FB_URL' is not set.")
    }
    // @ts-ignore
    this.source = FirebaseApp.getDatabaseByUrl(url, ScriptApp.getOAuthToken());
  }

  getConfig(): Config {
    if (!this.configCache) {
      this.configCache = this.getOrSet("Config", {
        TakeProfit: 0.1,
        SellAtTakeProfit: true,
        BuyQuantity: 10,
        LossLimit: 0.05,
        SECRET: 'none',
        KEY: 'none',
        PriceAsset: 'USDT',
        SellAtStopLimit: false,
        SwingTradeEnabled: false,
      })
    }
    return this.configCache;
  }

  setConfig(config: Config): void {
    this.configCache = config;
    this.set("Config", config)
  }

  increment(key: String): number {
    const num = +this.get(key) || 0;
    this.set(key, String(num + 1))
    return num
  }

  delete(key: String) {
    // @ts-ignore
    this.source.removeData(key)
  }

  get(key: String): any {
    // @ts-ignore
    return this.source.getData(key);
  }

  getOrSet(key: String, value: any): any {
    const val = this.get(key) || value;
    // @ts-ignore
    this.source.setData(key, val)
    return val
  }

  set(key: String, value: any): any {
    // @ts-ignore
    this.source.setData(key, value)
    return value
  }

  getKeys(): string[] {
    // @ts-ignore
    return Object.keys(this.source.getData())
  }

  getTrades(): { [p: string]: TradeMemo } {
    if (!this.tradesCache) {
      const trades = this.getOrSet("trade", {});
      // Fetches raw trades from Firebase and converts them to TradeMemo objects
      this.tradesCache = Object.keys(trades).reduce((acc, key) => {
        acc[key] = TradeMemo.fromObject(trades[key])
        return acc
      }, {})
    }
    return this.tradesCache;
  }

  getTradesList(): TradeMemo[] {
    return Object.values(this.getTrades())
  }

  getTrade(symbol: ExchangeSymbol): TradeMemo {
    return this.getTrades()[symbol.quantityAsset]
  }

  setTrade(tradeMemo: TradeMemo) {
    this.getTrades()[tradeMemo.tradeResult.symbol.quantityAsset] = tradeMemo
  }

  deleteTrade(tradeMemo: TradeMemo) {
    const trades = this.getTrades()
    delete trades[tradeMemo.tradeResult.symbol.quantityAsset]
  }

  dumpChanges() {
    this.set("trade", this.getTrades())
  }

}

export type Config = {
  TakeProfit: number
  SellAtTakeProfit: boolean
  BuyQuantity: number
  LossLimit: number
  SECRET?: string
  KEY?: string
  PriceAsset: string
  SellAtStopLimit: boolean
  SwingTradeEnabled?: boolean
}

// @ts-ignore
export const DefaultStore = this['DefaultStore'] = new FirebaseStore()
