import {
  CacheProxy,
  type DefaultCacheProxy,
  type ExpirationEntries,
} from "./CacheProxy";
import { isNode } from "browser-or-node";
import {
  DEFAULT_WAIT_LOCK,
  type IStore,
  StoreDeleteProp,
  StoreNoOp,
} from "../lib/index";

export const LOCK_TIMEOUT = `Lock timeout`;

export abstract class CommonStore {
  protected abstract get(key: string): any;
  protected abstract set(key: string, value: any): any;
  protected abstract delete(key: string): void;
  protected abstract lockService: {
    getScriptLock: () => {
      waitLock: (n: number) => void;
      releaseLock: () => void;
    };
  };

  update<T>(key, mutateFn): T | undefined {
    const lock = this.lockService?.getScriptLock();
    try {
      lock?.waitLock(DEFAULT_WAIT_LOCK);
    } catch (e) {
      throw new Error(
        `${LOCK_TIMEOUT}: Could not update the storage property '${key}' as another process is holding the access. Please, try again.`
      );
    }
    try {
      const curValue = this.get(key);
      const newValue = mutateFn(curValue);
      if (newValue === StoreNoOp) {
        // No change to current value
        return curValue;
      }
      if (newValue === StoreDeleteProp) {
        this.delete(key);
        return;
      }
      this.set(key, newValue);
      return newValue;
    } finally {
      lock?.releaseLock();
    }
  }
}

export class ScriptStore extends CommonStore implements IStore {
  protected lockService = LockService;

  get(key: string): any {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    return value ? JSON.parse(value) : null;
  }

  set(key: string, value: any): any {
    PropertiesService.getScriptProperties().setProperty(
      key,
      JSON.stringify(value)
    );
    return value;
  }

  delete(key: string): void {
    PropertiesService.getScriptProperties().deleteProperty(key);
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

  keepCacheAlive(): void {}

  clearCache(): void {}
}

export class FirebaseStore extends CommonStore implements IStore {
  protected lockService = LockService;

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

  get(key: string): any {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`);
    }
    // @ts-expect-error method is available at runtime only
    return this.source.getData(key);
  }

  set(key: string, value: any): any {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`);
    }
    // @ts-expect-error method is available at runtime only
    this.source.setData(key, value);
    return value;
  }

  delete(key: string): void {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`);
    }
    // @ts-expect-error method is available at runtime only
    this.source.removeData(key);
  }

  getKeys(): string[] {
    // @ts-expect-error method is available at runtime only
    const data = this.source.getData(``);
    return data && typeof data === `object` ? Object.keys(data) : [];
  }

  keepCacheAlive(): void {}

  clearCache(): void {}
}

export class CachedStore extends CommonStore implements IStore {
  protected lockService = LockService;

  #store: FirebaseStore | ScriptStore;
  #cache: DefaultCacheProxy;
  #syncIntervalSec = 5 * 60; // 5 minutes

  constructor(store: FirebaseStore | ScriptStore, cache: DefaultCacheProxy) {
    super();
    this.#store = store;
    this.#cache = cache;
  }

  connect(dbURL: string): void {
    this.#store.connect(dbURL);
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

  delete(key: string): void {
    this.#store.delete(key);
    this.#cache.remove(key);
  }

  getKeys(): string[] {
    return this.#store.getKeys();
  }

  isConnected(): boolean {
    return this.#store.isConnected();
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
