import Properties = GoogleAppsScript.Properties.Properties;

interface IStore {
  dump()

  get(key: string): string

  getKeys(): string[]

  set(key: string, value: string): string

  getOrSet(key: string, value: string): string

  delete(key: string)
}

class DefaultStore implements IStore {
  private readonly source: GoogleAppsScript.Properties.Properties;
  private readonly properties: { [p: string]: string };

  constructor(source: Properties) {
    this.source = source
    this.properties = source.getProperties()
  }

  dump() {
    this.source.setProperties(this.properties, true)
  }

  delete(key: string) {
    delete this.properties[key]
  }

  get(key: string): string {
    return this.properties[key];
  }

  getOrSet(key: string, value: string): string {
    this.properties[key] = this.properties[key] || value
    return this.get(key)
  }

  set(key: string, value: string): string {
    this.properties[key] = value
    return this.get(key)
  }

  getKeys(): string[] {
    return Object.keys(this.properties)
  }

}
