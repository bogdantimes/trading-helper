import {
  DefaultCacheProxy,
  Entries,
  ExpirationEntries,
  MAX_EXPIRATION,
} from "../src/gas/CacheProxy"

export class InMemoryCache extends DefaultCacheProxy {
  #kvMap: { [key: string]: any } = {}
  #ttl: { [key: string]: number } = {}
  #curStep = 0

  get(key: string): string | null {
    return this.#kvMap[key]
  }

  step() {
    // step means 1 minute passed
    this.#curStep++
    // remove expired keys
    Object.keys(this.#ttl).forEach((key) => {
      if (this.#ttl[key] < this.#curStep) {
        delete this.#kvMap[key]
        delete this.#ttl[key]
      }
    })
  }

  put(
    key: string,
    value: string,
    expirationInSeconds: GoogleAppsScript.Integer | undefined = MAX_EXPIRATION,
  ): void {
    this.#kvMap[key] = value
    this.#ttl[key] = this.#curStep + expirationInSeconds / 60
  }

  remove(key: string): void {
    delete this.#kvMap[key]
  }

  getAll(keys: string[]): Entries {
    return keys.reduce((acc, key) => {
      acc[key] = this.get(key)
      return acc
    }, {} as Entries)
  }

  putAll(values: ExpirationEntries): void {
    Object.keys(values).forEach((key) => {
      const { value, expiration = MAX_EXPIRATION } = values[key]
      this.put(key, value, expiration)
    })
  }

  removeAll(keys: string[]): void {
    keys.forEach((key) => this.remove(key))
  }
}
