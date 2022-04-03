import Properties = GoogleAppsScript.Properties.Properties;
import {TradeMemo} from "./TradeMemo";

export interface IStore {
  get(key: String): any

  getKeys(): string[]

  set(key: String, value: any): any

  getOrSet(key: String, value: any): any

  increment(key: String): number

  delete(key: String)
}

class GapsStore implements IStore {
  private readonly source: GoogleAppsScript.Properties.Properties;

  constructor(source: Properties) {
    this.source = source
  }

  increment(key: String): number {
    const num = +this.get(key) || 0;
    this.set(key, String(num + 1))
    return num
  }

  delete(key: String) {
    this.source.deleteProperty(key.toString())
  }

  get(key: String): any {
    return this.source.getProperty(key.toString());
  }

  getOrSet(key: String, value: any): any {
    const val = this.get(key) || value;
    this.source.setProperty(key.toString(), val)
    return val
  }

  set(key: String, value: any): any {
    this.source.setProperty(key.toString(), value)
    return value
  }

  getKeys(): string[] {
    return this.source.getKeys()
  }

}

class FirebaseStore implements IStore {
  private readonly source: object

  constructor() {
    const url = PropertiesService.getScriptProperties().getProperty("FB_URL")
    if (!url) {
      throw Error("Firebase URL key 'FB_URL' is not set.")
    }
    // @ts-ignore
    this.source = FirebaseApp.getDatabaseByUrl(url, ScriptApp.getOAuthToken());
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

}

// @ts-ignore
export const DefaultStore = this["DefaultStore"] = new FirebaseStore();

export type Config = {
  TakeProfit: number
  SellAtTakeProfit: boolean
  BuyQuantity: number
  LossLimit: number
  SECRET: string
  KEY: string
  PriceAsset: string
  SellAtStopLimit: boolean
}

function getTrades(): { [p: string]: TradeMemo } {
  return DefaultStore.getOrSet("trade", {})
}

function getConfig(): Config {
  return DefaultStore.getOrSet("Config", {
    TakeProfit: 0.1,
    SellAtTakeProfit: true,
    BuyQuantity: 10,
    LossLimit: 0.05,
    SECRET: 'none',
    KEY: 'none',
    PriceAsset: 'USDT',
    SellAtStopLimit: false,
  })
}

function setConfig(config: Config) {
  DefaultStore.set("Config", config)
}

