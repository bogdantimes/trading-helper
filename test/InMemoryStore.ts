import { IStore } from "../src/gas/Store"

export class InMemoryStore implements IStore {
  #kvMap: { [key: string]: any } = {}

  connect(dbURL: string): void {
    // do nothing
  }

  delete(key: string): void {
    delete this.#kvMap[key]
  }

  get(key: string): any {
    return this.#kvMap[key]
  }

  getKeys(): string[] {
    return Object.keys(this.#kvMap)
  }

  getOrSet(key: string, value: any): any {
    return this.get(key) || this.set(key, value)
  }

  isConnected(): boolean {
    return true
  }

  set(key: string, value: any): any {
    this.#kvMap[key] = value
    return value
  }

  prettyPrint() {
    console.log(JSON.stringify(this.#kvMap, null, 2))
  }
}
