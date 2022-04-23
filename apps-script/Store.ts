import {TradeMemo} from "./TradeMemo";
import {ExchangeSymbol} from "./TradeResult";
import {CacheProxy} from "./CacheProxy";

export interface IStore {
  get(key: String): any

  set(key: String, value: any): any

  getConfig(): Config

  setConfig(config: Config): void

  getOrSet(key: String, value: any): any

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

  constructor() {
    const url = PropertiesService.getScriptProperties().getProperty("FB_URL")
    if (!url) {
      throw Error("Firebase URL key 'FB_URL' is not set.")
    }
    // @ts-ignore
    this.source = FirebaseApp.getDatabaseByUrl(url, ScriptApp.getOAuthToken());
  }

  getConfig(): Config {
    const configCacheJson = CacheProxy.get("Config");
    let configCache = configCacheJson ? JSON.parse(configCacheJson) : null;
    if (!configCache) {
      configCache = this.getOrSet("Config", {
        TakeProfit: 0.1,
        SellAtTakeProfit: true,
        BuyQuantity: 10,
        LossLimit: 0.05,
        SECRET: '',
        KEY: '',
        PriceAsset: 'USDT',
        SellAtStopLimit: false,
        SwingTradeEnabled: false,
      })
      CacheProxy.put("Config", JSON.stringify(configCache))
    }
    return configCache;
  }

  setConfig(config: Config): void {
    this.set("Config", config)
    CacheProxy.put("Config", JSON.stringify(config))
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

  getTrades(): { [p: string]: TradeMemo } {
    const tradesCacheJson = CacheProxy.get("Trades");
    let tradesCache = tradesCacheJson ? JSON.parse(tradesCacheJson) : null;
    if (!tradesCache) {
      tradesCache = this.getOrSet("trade", {});
      CacheProxy.put("Trades", JSON.stringify(tradesCache))
    }
    // Convert raw trades to TradeMemo objects
    return Object.keys(tradesCache).reduce((acc, key) => {
      acc[key] = TradeMemo.fromObject(tradesCache[key])
      return acc
    }, {});
  }

  getTradesList(): TradeMemo[] {
    return Object.values(this.getTrades())
  }

  getTrade(symbol: ExchangeSymbol): TradeMemo {
    return this.getTrades()[symbol.quantityAsset]
  }

  setTrade(tradeMemo: TradeMemo) {
    const trades = this.getTrades();
    trades[tradeMemo.tradeResult.symbol.quantityAsset] = tradeMemo
    CacheProxy.put("Trades", JSON.stringify(trades))
  }

  deleteTrade(tradeMemo: TradeMemo) {
    const trades = this.getTrades()
    delete trades[tradeMemo.tradeResult.symbol.quantityAsset]
    CacheProxy.put("Trades", JSON.stringify(trades))
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
