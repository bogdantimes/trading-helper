import Integer = GoogleAppsScript.Integer;

const MAX_CACHE_VAL_SIZE_BYTES = 100 * 1024;

function byteCount(s: string): Integer {
  return encodeURI(s).split(/%..|./).length - 1;
}

export class CacheProxy {
  static get(key: string): string {
    return CacheService.getScriptCache().get(key);
  }

  static put(key: string, value: string): void {
    const size = byteCount(value);
    if (size > 0.9 * MAX_CACHE_VAL_SIZE_BYTES) {
      Log.info(`Cache value for key ${key} is more than 90% of the maximum size of ${MAX_CACHE_VAL_SIZE_BYTES} bytes.`);
    }
    if (size > MAX_CACHE_VAL_SIZE_BYTES) {
      const error = new Error(`Cache value for ${key} is too large: ${size} bytes. Max size is ${MAX_CACHE_VAL_SIZE_BYTES} bytes.`);
      Log.error(error);
      throw error;
    }
    CacheService.getScriptCache().put(key, value);
  }

  static remove(key: string): void {
    CacheService.getScriptCache().remove(key);
  }
}
