import { CacheProxy, DefaultCacheProxy } from "./CacheProxy"
import { Log } from "./Common"

export interface IStore {
  get(key: string): any

  getKeys(): string[]

  set(key: string, value: any): any

  getOrSet(key: string, value: any): any

  delete(key: string): void

  isConnected(): boolean

  connect(dbURL: string): void
}

export class ScriptStore implements IStore {
  delete(key: string): void {
    PropertiesService.getScriptProperties().deleteProperty(key)
  }

  get(key: string): any {
    const value = PropertiesService.getScriptProperties().getProperty(key)
    return value ? JSON.parse(value) : null
  }

  getKeys(): string[] {
    return PropertiesService.getScriptProperties().getKeys()
  }

  getOrSet(key: string, value: any): any {
    return this.get(key) || this.set(key, value)
  }

  isConnected(): boolean {
    return true
  }

  connect(): void {
    // noop
  }

  set(key: string, value: any): any {
    PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(value))
    return value
  }
}

export class FirebaseStore implements IStore {
  private source: object

  constructor() {
    const url = FirebaseStore.url
    if (url) {
      // @ts-ignore
      this.source = FirebaseApp.getDatabaseByUrl(url, ScriptApp.getOAuthToken())
    }
  }

  static get url(): string {
    return PropertiesService.getScriptProperties().getProperty(`dbURL`)
  }

  static set url(url: string) {
    if (url) {
      PropertiesService.getScriptProperties().setProperty(`dbURL`, url)
    } else {
      PropertiesService.getScriptProperties().deleteProperty(`dbURL`)
    }
  }

  connect(dbURL: string): void {
    // @ts-ignore
    this.source = FirebaseApp.getDatabaseByUrl(dbURL, ScriptApp.getOAuthToken())
    FirebaseStore.url = dbURL
  }

  disconnect(): void {
    this.source = null
    FirebaseStore.url = null
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

  getKeys(): string[] {
    // @ts-ignore
    const data = this.source.getData(``)
    return data && typeof data === `object` ? Object.keys(data) : []
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

export class CachedStore implements IStore {
  #store: IStore
  #cache: DefaultCacheProxy
  #syncIntervalSec = 5 * 60 // 5 minutes

  constructor(store: IStore, cache: DefaultCacheProxy) {
    this.#store = store
    this.#cache = cache
    this.#syncCache()
  }

  connect(dbURL: string): void {
    this.#store.connect(dbURL)
  }

  delete(key: string): void {
    this.#store.delete(key)
    this.#cache.remove(key)
  }

  get(key: string): any {
    const cached = this.#cache.get(key)
    let value = cached ? JSON.parse(cached) : null
    if (!value) {
      value = this.#store.get(key)
      value && this.#cache.put(key, JSON.stringify(value))
    }
    return value
  }

  getKeys(): string[] {
    return this.#store.getKeys()
  }

  getOrSet(key: string, value: any): any {
    return this.get(key) || this.set(key, value)
  }

  isConnected(): boolean {
    return this.#store.isConnected()
  }

  set(key: string, value: any): any {
    const synced = this.#cache.get(`${key}_synced`)
    if (!synced) {
      this.#store.set(key, value)
      this.#cache.put(`${key}_synced`, `true`, this.#syncIntervalSec)
    }
    this.#cache.put(key, JSON.stringify(value))
    return value
  }

  #syncCache() {
    const cachedStoreValues = this.#cache.getAll(this.#store.getKeys())
    Object.keys(cachedStoreValues).forEach((key) =>
      this.set(key, JSON.parse(cachedStoreValues[key])),
    )
  }
}

const defaultStore = FirebaseStore.url ? new FirebaseStore() : new ScriptStore()
export const DefaultStore = new CachedStore(defaultStore, CacheProxy)
