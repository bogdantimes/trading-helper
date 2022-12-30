import Integer = GoogleAppsScript.Integer;
import { Log, SECONDS_IN_HOUR } from "./Common";
import { ICacheProxy } from "../lib";

const MAX_CACHE_VAL_SIZE_BYTES = 100 * 1024;

function byteCount(s: string): number {
  return encodeURI(s).split(/%..|./).length - 1;
}

export const MAX_EXPIRATION = SECONDS_IN_HOUR * 6;

export type Entries = Record<string, any>;
export type ExpirationEntries = Record<
  string,
  {
    value: string;
    expiration?: Integer;
  }
>;

export class DefaultCacheProxy implements ICacheProxy {
  get(key: string): string | null {
    return CacheService.getScriptCache().get(key);
  }

  getAll(keys: string[]): Entries {
    return CacheService.getScriptCache().getAll(keys);
  }

  putAll(values: ExpirationEntries): void {
    // group values into maps by expiration
    const map: Record<Integer, Record<string, any>> = {};
    Object.keys(values).forEach((key) => {
      const { value, expiration = MAX_EXPIRATION } = values[key];
      map[expiration] = map[expiration] || {};
      map[expiration][key] = value;
    });
    // put all values into cache
    Object.keys(map).forEach((expiration) => {
      CacheService.getScriptCache().putAll(map[+expiration], +expiration);
    });
  }

  /**
   * @param key
   * @param value
   * @param expirationInSeconds By default, keep for 6 hours (maximum time allowed by GAS)
   */
  put(
    key: string,
    value: string,
    expirationInSeconds: Integer = MAX_EXPIRATION
  ): void {
    const size = byteCount(value);
    if (size > 0.9 * MAX_CACHE_VAL_SIZE_BYTES) {
      Log.info(
        `Cache value for key ${key} is more than 90% of the maximum size of ${MAX_CACHE_VAL_SIZE_BYTES} bytes.`
      );
    }
    if (size > MAX_CACHE_VAL_SIZE_BYTES) {
      const error = new Error(
        `Cache value for ${key} is too large: ${size} bytes. Max size is ${MAX_CACHE_VAL_SIZE_BYTES} bytes.`
      );
      Log.error(error);
      throw error;
    }
    // Log.debug(`Value for key ${key} is ${size} bytes. Which is ${Math.round(size / MAX_CACHE_VAL_SIZE_BYTES * 100)}% of the maximum.`);
    CacheService.getScriptCache().put(key, value, expirationInSeconds);
  }

  remove(key: string): void {
    CacheService.getScriptCache().remove(key);
  }

  removeAll(keys: string[]): void {
    CacheService.getScriptCache().removeAll(keys);
  }
}

export const CacheProxy = new DefaultCacheProxy();
