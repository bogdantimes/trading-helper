import { CacheProxy, DefaultCacheProxy } from "./CacheProxy";
import { isNode } from "browser-or-node";
import { IStore } from "../lib/index";

export class ScriptStore implements IStore {
  delete(key: string): void {
    PropertiesService.getScriptProperties().deleteProperty(key);
  }

  get(key: string): any {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    return value ? JSON.parse(value) : null;
  }

  getKeys(): string[] {
    return PropertiesService.getScriptProperties().getKeys();
  }

  getOrSet(key: string, value: any): any {
    return this.get(key) || this.set(key, value);
  }

  isConnected(): boolean {
    return true;
  }

  connect(): void {
    // noop
  }

  set(key: string, value: any): any {
    PropertiesService.getScriptProperties().setProperty(
      key,
      JSON.stringify(value)
    );
    return value;
  }

  keepCacheAlive(): void {}
}

export class FirebaseStore implements IStore {
  #source: object | null = null;

  static get url(): string | null {
    return PropertiesService.getScriptProperties().getProperty(`dbURL`);
  }

  static set url(url: string | null) {
    if (url) {
      PropertiesService.getScriptProperties().setProperty(`dbURL`, url);
    } else {
      PropertiesService.getScriptProperties().deleteProperty(`dbURL`);
    }
  }

  private get source(): object | null {
    if (!this.#source) {
      const url = FirebaseStore.url;
      if (url) {
        // @ts-expect-error
        this.#source = FirebaseApp.getDatabaseByUrl(
          url,
          ScriptApp.getOAuthToken()
        );
      }
    }
    return this.#source;
  }

  private set source(source: object | null) {
    this.#source = source;
  }

  connect(dbURL: string): void {
    // @ts-expect-error
    this.source = FirebaseApp.getDatabaseByUrl(
      dbURL,
      ScriptApp.getOAuthToken()
    );
    FirebaseStore.url = dbURL;
  }

  disconnect(): void {
    this.source = null;
    FirebaseStore.url = null;
  }

  isConnected(): boolean {
    return !!this.source;
  }

  delete(key: string): void {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`);
    }
    // @ts-expect-error
    this.source.removeData(key);
  }

  get(key: string): any {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`);
    }
    // @ts-expect-error
    return this.source.getData(key);
  }

  getKeys(): string[] {
    // @ts-expect-error
    const data = this.source.getData(``);
    return data && typeof data === `object` ? Object.keys(data) : [];
  }

  getOrSet(key: string, value: any): any {
    return this.get(key) || this.set(key, value);
  }

  set(key: string, value: any): any {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`);
    }
    // @ts-expect-error
    this.source.setData(key, value);
    return value;
  }

  keepCacheAlive(): void {}
}

export class CachedStore implements IStore {
  #store: IStore;
  #cache: DefaultCacheProxy;
  #syncIntervalSec = 5 * 60; // 5 minutes

  constructor(store: IStore, cache: DefaultCacheProxy) {
    this.#store = store;
    this.#cache = cache;
  }

  connect(dbURL: string): void {
    this.#store.connect(dbURL);
  }

  delete(key: string): void {
    this.#store.delete(key);
    this.#cache.remove(key);
  }

  get(key: string): any {
    const cached = this.#cache.get(key);
    let value = cached ? JSON.parse(cached) : null;
    if (!value) {
      value = this.#store.get(key);
      value && this.#cache.put(key, JSON.stringify(value));
    }
    return value;
  }

  getKeys(): string[] {
    return this.#store.getKeys();
  }

  getOrSet(key: string, value: any): any {
    return this.get(key) || this.set(key, value);
  }

  isConnected(): boolean {
    return this.#store.isConnected();
  }

  set(key: string, value: any): any {
    this.#cache.put(key, JSON.stringify(value));
    const synced = this.#cache.get(`${key}_synced`);
    if (!synced) {
      this.#store.set(key, value);
      this.#cache.put(`${key}_synced`, `true`, this.#syncIntervalSec);
    }
    return value;
  }

  keepCacheAlive(): void {
    // Iterate all Store paths and get/put values to reset expiration
    const cachedStoreValues = this.#cache.getAll(this.#store.getKeys());
    Object.keys(cachedStoreValues).forEach((key) => {
      if (cachedStoreValues[key]) {
        this.set(key, JSON.parse(cachedStoreValues[key]));
      }
    });
  }
}

function getStore(): IStore {
  const defaultStore = FirebaseStore.url
    ? new FirebaseStore()
    : new ScriptStore();
  return new CachedStore(defaultStore, CacheProxy);
}

export const DefaultStore: IStore = isNode ? null : getStore();
