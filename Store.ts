import Properties = GoogleAppsScript.Properties.Properties;

interface IStore {
  get(key: String): string

  getKeys(): string[]

  set(key: String, value: String): String

  getOrSet(key: String, value: String): String

  increment(key: String): number

  delete(key: String)
}

class GapsStore implements IStore {
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

class FirebaseStore implements IStore {
  private readonly source: object

  constructor() {
    const url = PropertiesService.getScriptProperties().getProperty("FB_URL")
    if (!url) {
      throw Error("Firebase URL key 'FB_URL' is not set.")
    }
    // @ts-ignore
    this.source = FirebaseApp.getDatabaseByUrl(url, ScriptApp.getOAuthToken());
  }

  increment(key: String): number {
    const num = +this.get(key) || 0;
    this.set(key, String(num + 1))
    return num
  }

  delete(key: String) {
    // @ts-ignore
    this.source.removeData(key)
  }

  get(key: String): string {
    // @ts-ignore
    return this.source.getData(key);
  }

  getOrSet(key: String, value: String): String {
    const val = this.get(key) || value;
    // @ts-ignore
    this.source.setData(key, val)
    return val
  }

  set(key: String, value: String): String {
    // @ts-ignore
    this.source.setData(key, value)
    return value
  }

  getKeys(): string[] {
    // @ts-ignore
    return Object.keys(this.source.getData())
  }

}

const DefaultStore = new FirebaseStore()
