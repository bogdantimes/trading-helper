import Properties = GoogleAppsScript.Properties.Properties;

interface IStore {
  get(key: string): string

  getKeys(): string[]

  set(key: string, value: string): string

  getOrSet(key: string, value: string): string

  increment(key: string): number

  delete(key: string)
}

class DefaultStore implements IStore {
  private readonly source: GoogleAppsScript.Properties.Properties;

  constructor(source: Properties) {
    this.source = source
  }

  increment(key: string): number {
    const num = +this.get(key) || 0;
    this.set(key, String(num + 1))
    return num
  }

  delete(key: string) {
    this.source.deleteProperty(key)
  }

  get(key: string): string {
    return this.source.getProperty(key);
  }

  getOrSet(key: string, value: string): string {
    const val = this.get(key) || value;
    this.source.setProperty(key, val)
    return val
  }

  set(key: string, value: string): string {
    this.source.setProperty(key, value)
    return value
  }

  getKeys(): string[] {
    return this.source.getKeys()
  }

}
