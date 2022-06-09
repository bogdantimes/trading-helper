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
