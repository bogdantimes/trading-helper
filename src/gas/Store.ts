import { CacheProxy } from "./CacheProxy"
import {
  AutoTradeBestScores,
  Config,
  PriceProvider,
  ScoreSelectivity,
  ScoreSelectivityKeys,
  StableUSDCoin,
} from "trading-helper-lib"
import { Log } from "./Common"

export interface IStore {
  get(key: string): any

  set(key: string, value: any): any

  getConfig(): Config

  setConfig(config: Config): void

  getOrSet(key: string, value: any): any

  delete(key: string)

  isConnected(): boolean
}

export class FirebaseStore implements IStore {
  private source: object

  constructor() {
    if (this.url) {
      // @ts-ignore
      this.source = FirebaseApp.getDatabaseByUrl(this.url, ScriptApp.getOAuthToken())
    } else {
      Log.info(`Firebase Realtime Database is not connected.`)
      Log.info(`Google Apps Script property 'dbURL' is missing.`)
    }
    // If URL changed - clean trades and config cache
    const cachedURL = CacheProxy.get(`dbURL`)
    if (!!cachedURL && cachedURL !== this.url) {
      Log.alert(`Firebase Realtime Database URL changed.`)
      CacheProxy.remove(`Trades`)
      CacheProxy.remove(`Config`)
    }
    CacheProxy.put(`dbURL`, this.url)
  }

  get url(): string {
    return PropertiesService.getScriptProperties().getProperty(`dbURL`)
  }

  set url(url: string) {
    PropertiesService.getScriptProperties().setProperty(`dbURL`, url)
  }

  connect(dbURL: string) {
    // @ts-ignore
    this.source = FirebaseApp.getDatabaseByUrl(dbURL, ScriptApp.getOAuthToken())
    this.url = dbURL
  }

  isConnected(): boolean {
    return !!this.source
  }

  getConfig(): Config {
    const defaultConfig: Config = {
      BuyQuantity: 10,
      StableCoin: StableUSDCoin.USDT,
      StopLimit: 0.05,
      ProfitLimit: 0.1,
      SellAtStopLimit: false,
      SellAtProfitLimit: true,
      SwingTradeEnabled: false,
      PriceProvider: PriceProvider.Binance,
      AveragingDown: false,
      ProfitBasedStopLimit: false,
      PriceAnomalyAlert: 5,
      ScoreSelectivity: `MODERATE`,
      AutoTradeBestScores: AutoTradeBestScores.OFF,
    }
    const configCacheJson = CacheProxy.get(`Config`)
    let configCache: Config = configCacheJson ? JSON.parse(configCacheJson) : null
    if (!configCache) {
      configCache = this.getOrSet(`Config`, defaultConfig)
    }
    // apply existing config on top of default one
    configCache = Object.assign(defaultConfig, configCache)

    if (configCache.ScoreUpdateThreshold === 0.05) {
      // 0.05 used to be a default value, no it's not
      configCache.ScoreUpdateThreshold = defaultConfig.ScoreUpdateThreshold
    }

    if (configCache.ScoreUpdateThreshold) {
      configCache.ScoreSelectivity = ScoreSelectivity[
        configCache.ScoreUpdateThreshold
      ] as ScoreSelectivityKeys
      delete configCache.ScoreUpdateThreshold
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

    CacheProxy.put(`Config`, JSON.stringify(configCache))

    return configCache
  }

  setConfig(config: Config): void {
    this.set(`Config`, config)
    CacheProxy.put(`Config`, JSON.stringify(config))
  }

  delete(key: string) {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`)
    }
    // @ts-ignore
    this.source.removeData(key)
  }

  get(key: string): any {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`)
    }
    // @ts-ignore
    return this.source.getData(key)
  }

  getOrSet(key: string, value: any): any {
    return this.get(key) || this.set(key, value)
  }

  set(key: string, value: any): any {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`)
    }
    // @ts-ignore
    this.source.setData(key, value)
    return value
  }
}

export const DefaultStore = new FirebaseStore()
