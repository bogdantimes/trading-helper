import Properties = GoogleAppsScript.Properties.Properties;

interface IStore {
  get(key: String): string

  getKeys(): string[]

  set(key: String, value: String): String

  getOrSet(key: String, value: String): String

  increment(key: String): number

  delete(key: String)
}

class DefaultStore implements IStore {
  private readonly source: GoogleAppsScript.Properties.Properties;

  constructor(source: Properties) {
    this.source = source
  }

  increment(key: String): number {
    const num = +this.get(key) || 0;
    this.set(key, String(num + 1))
    return num
  }

  delete(key: String) {
    this.source.deleteProperty(key)
  }

  get(key: String): string {
    return this.source.getProperty(key);
  }

  getOrSet(key: String, value: String): String {
    const val = this.get(key) || value;
    this.source.setProperty(key, val)
    return val
  }

  set(key: String, value: String): String {
    this.source.setProperty(key, value)
    return value
  }

  getKeys(): string[] {
    return this.source.getKeys()
  }

}
