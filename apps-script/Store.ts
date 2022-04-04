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
    return this.getOrSet("Config", {
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

  setConfig(config: Config): void {
    this.getOrSet("Config", config)
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
    return this.getOrSet("trade", {});
  }

}

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

// @ts-ignore
export const DefaultStore = this['DefaultStore'] = new FirebaseStore()
