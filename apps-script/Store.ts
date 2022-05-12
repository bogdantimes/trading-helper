import {TradeMemo} from "./TradeMemo";
import {ExchangeSymbol, PriceProvider, StableUSDCoin} from "./TradeResult";
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

  isConnected(): boolean
}

export class FirebaseStore implements IStore {
  private readonly dbURLKey = "dbURL";
  private source: object

  constructor() {
    const url = PropertiesService.getScriptProperties().getProperty(this.dbURLKey)
    if (url) {
      // @ts-ignore
      this.source = FirebaseApp.getDatabaseByUrl(url, ScriptApp.getOAuthToken());
    } else {
      Log.info("Firebase URL key 'dbURL' is not set.")
    }
  }


  connect(dbURL: string) {
    // @ts-ignore
    this.source = FirebaseApp.getDatabaseByUrl(dbURL, ScriptApp.getOAuthToken());
    PropertiesService.getScriptProperties().setProperty(this.dbURLKey, dbURL);
  }

  isConnected(): boolean {
    return !!this.source
  }

  getConfig(): Config {
    const configCacheJson = CacheProxy.get("Config");
    let configCache: Config = configCacheJson ? JSON.parse(configCacheJson) : null;
    if (!configCache) {
      const defaultConfig: Config = {
        KEY: '',
        SECRET: '',
        BuyQuantity: 10,
        StableCoin: StableUSDCoin.USDT,
        StopLimit: 0.05,
        ProfitLimit: 0.1,
        SellAtStopLimit: false,
        SellAtProfitLimit: true,
        SwingTradeEnabled: false,
        PriceProvider: PriceProvider.Binance,
        AveragingDown: false,
      }
      configCache = this.getOrSet("Config", defaultConfig)
    }

    if (configCache.TakeProfit) {
      configCache.ProfitLimit = configCache.TakeProfit
      delete configCache.TakeProfit
    }

    if (configCache.SellAtTakeProfit) {
      configCache.SellAtProfitLimit = configCache.SellAtTakeProfit
      delete configCache.SellAtTakeProfit
    }

    if (configCache.LossLimit) {
      configCache.StopLimit = configCache.LossLimit
      delete configCache.LossLimit
    }

    if (configCache.PriceAsset) {
      configCache.StableCoin = <StableUSDCoin>configCache.PriceAsset
      delete configCache.PriceAsset
    }

    CacheProxy.put("Config", JSON.stringify(configCache))

    return configCache;
  }

  setConfig(config: Config): void {
    this.set("Config", config)
    CacheProxy.put("Config", JSON.stringify(config))
  }

  delete(key: String) {
    if (!this.isConnected()) {
      throw new Error("Firebase is not connected.")
    }
    // @ts-ignore
    this.source.removeData(key)
  }

  get(key: String): any {
    if (!this.isConnected()) {
      throw new Error("Firebase is not connected.")
    }
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
    if (!this.isConnected()) {
      throw new Error("Firebase is not connected.")
    }
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
  KEY?: string
  SECRET?: string
  StableCoin: StableUSDCoin
  BuyQuantity: number
  StopLimit: number
  ProfitLimit: number
  SellAtStopLimit: boolean
  SellAtProfitLimit: boolean
  SwingTradeEnabled: boolean
  PriceProvider: PriceProvider
  /**
   * When averaging down is enabled, all the money gained from selling is used to buy more your existing
   * most unprofitable (in percentage) asset.
   * If you have assets A, B (-10% loss) and C(-15% loss) and A is sold, the tool will buy more
   * of C, and C loss will be averaged down, for example to -7%.
   * Next time, if C turns profitable and is sold, the tool will buy more of B.
   * This way, **if the price decline is temporary** for all of your assets,
   * the tool will gradually sell all assets without loss.
   */
  AveragingDown: boolean

  /**
   * @deprecated
   */
  PriceAsset?: string
  /**
   * @deprecated
   */
  TakeProfit?: number
  /**
   * @deprecated
   */
  LossLimit?: number
  /**
   * @deprecated
   */
  SellAtTakeProfit?: boolean
}

export const DefaultStore = (this as any)['DefaultStore'] = new FirebaseStore()
