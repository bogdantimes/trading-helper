import {
  CacheProxy,
  type DefaultCacheProxy,
  type ExpirationEntries,
} from "./CacheProxy";
import { isNode } from "browser-or-node";
import { type IStore } from "../lib/index";

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

  clearCache(): void {}
}

export class FirebaseStore implements IStore {
  #source: object | null = null;

  static get url(): string {
    return PropertiesService.getScriptProperties().getProperty(`dbURL`) ?? ``;
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
        // @ts-expect-error FirebaseApp is available in GAS runtime only
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
    // @ts-expect-error FirebaseApp is available in GAS runtime only
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
    // @ts-expect-error method is available at runtime only
    this.source.removeData(key);
  }

  get(key: string): any {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`);
    }
    // @ts-expect-error method is available at runtime only
    return this.source.getData(key);
  }

  getKeys(): string[] {
    // @ts-expect-error method is available at runtime only
    const data = this.source.getData(``);
    return data && typeof data === `object` ? Object.keys(data) : [];
  }

  set(key: string, value: any): any {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`);
    }
    // @ts-expect-error method is available at runtime only
    this.source.setData(key, value);
    return value;
  }

  keepCacheAlive(): void {}

  clearCache(): void {}
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

  isConnected(): boolean {
    return this.#store.isConnected();
  }

  set(key: string, value: any): any {
    if (
      !value ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === `object` && Object.keys(value).length === 0)
    ) {
      this.#cache.remove(key);
      return value;
    }

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
    const cachedValues = this.#cache.getAll(this.#store.getKeys());
    const putBackValues: ExpirationEntries = {};
    Object.keys(cachedValues).forEach((key) => {
      putBackValues[key] = { value: cachedValues[key] };
    });
    this.#cache.putAll(putBackValues);
  }

  clearCache(): void {
    this.#cache.removeAll(this.#store.getKeys());
  }
}

function getStore(): IStore {
  const defaultStore = FirebaseStore.url
    ? new FirebaseStore()
    : new ScriptStore();
  return new CachedStore(defaultStore, CacheProxy);
}

// @ts-expect-error ignoring null assignment
export const DefaultStore: IStore = isNode ? null : getStore();
