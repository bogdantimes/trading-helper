import { CacheProxy, DefaultProfileCacheProxy } from "./CacheProxy"
import {
  AutoTradeBestScores,
  Config,
  ICacheProxy,
  PriceProvider,
  Profile,
  ScoreSelectivity,
  ScoreSelectivityKeys,
  StableUSDCoin,
  TradeMemo,
  TradeState,
} from "trading-helper-lib"
import { DefaultProfile, execute, Log } from "./Common"

export interface IStore {
  get(key: string): any

  set(key: string, value: any): any

  getConfig(): Config

  setConfig(config: Config): void

  getOrSet(key: string, value: any): any

  delete(key: string)

  getTrades(): { [key: string]: TradeMemo }

  getTradesList(state?: TradeState): TradeMemo[]

  hasTrade(coinName: string): boolean

  changeTrade(
    coinName: string,
    mutateFn: (tm: TradeMemo) => TradeMemo,
    notFoundFn?: () => TradeMemo | undefined,
  ): void

  dumpChanges(): void

  isConnected(): boolean
}

export class FirebaseStore implements IStore {
  private source: object
  private readonly cache: ICacheProxy
  private readonly profile: Profile

  constructor(profile: Profile) {
    if (!profile) throw new Error(`Profile is required`)

    this.profile = profile
    this.cache = new CacheProxy(profile)

    if (this.url) {
      // @ts-ignore
      this.source = FirebaseApp.getDatabaseByUrl(this.url, ScriptApp.getOAuthToken())
    } else {
      Log.info(`Firebase Realtime Database is not connected.`)
      Log.info(`Google Apps Script property 'dbURL' is missing.`)
    }
    // If URL changed - clean trades and config cache
    const cachedURL = this.cache.get(`dbURL`)
    if (!!cachedURL && cachedURL !== this.url) {
      Log.alert(`Firebase Realtime Database URL changed.`)
      this.cache.remove(`Trades`)
      this.cache.remove(`Config`)
    }
    this.cache.put(`dbURL`, this.url)
  }

  get url(): string {
    return PropertiesService.getScriptProperties().getProperty(`dbURL`)
  }

  set url(url: string) {
    PropertiesService.getScriptProperties().setProperty(`dbURL`, url)
  }

  connect(dbURL: string): void {
    // @ts-ignore
    this.source = FirebaseApp.getDatabaseByUrl(dbURL, ScriptApp.getOAuthToken())
    this.url = dbURL
  }

  isConnected(): boolean {
    return !!this.source
  }

  static getProfiles(): { [key: string]: Profile } {
    const profilesJson = DefaultProfileCacheProxy.get(`Profiles`)
    let profiles = profilesJson ? JSON.parse(profilesJson) : null
    if (!profiles) {
      profiles = DefaultProfileStore.get(`Profiles`) || {}
      DefaultProfileCacheProxy.put(`Profiles`, JSON.stringify(profiles))
    }
    profiles.default = DefaultProfile
    return profiles
  }

  static newProfileConfig(profile: Profile): Config {
    const { KEY, SECRET, StableCoin } = DefaultProfileStore.getConfig()
    const defaultConfig = FirebaseStore.getDefaultConfig(profile)
    return Object.assign(defaultConfig, { KEY, SECRET, StableCoin })
  }

  static createProfile(profile: Profile, config: Config): void {
    const profiles = FirebaseStore.getProfiles()
    if (profiles[profile.name]) {
      throw new Error(`Profile with name ${profile.name} already exists.`)
    }
    const profileStore = new FirebaseStore(profile)
    profileStore.setConfig(config)
    profiles[profile.name] = profile
    DefaultProfileStore.set(`Profiles/${profile.name}`, profile)
    DefaultProfileCacheProxy.put(`Profiles`, JSON.stringify(profiles))
  }

  static deleteProfile(profile: Profile) {
    const profiles = FirebaseStore.getProfiles()
    if (!profiles[profile.name]) {
      throw new Error(`Profile with name ${profile.name} does not exist.`)
    }
    const profileStore = new FirebaseStore(profile)
    profileStore.delete(`Config`)
    DefaultProfileStore.delete(`Profiles/${profile.name}`)
  }

  getConfig(): Config {
    const defaultConfig = FirebaseStore.getDefaultConfig(this.profile)
    const configCacheJson = this.cache.get(`Config`)
    let configCache: Config = configCacheJson ? JSON.parse(configCacheJson) : null
    if (!configCache) {
      configCache = this.getOrSet(`Config`, defaultConfig)
    }
    // apply existing config on top of default one
    configCache = Object.assign(defaultConfig, configCache)

    if (configCache.ScoreUpdateThreshold === 0.05) {
      // 0.05 used to be a default value, no it's not
      configCache.ScoreUpdateThreshold = defaultConfig.ScoreUpdateThreshold
    }

    if (configCache.ScoreUpdateThreshold) {
      configCache.ScoreSelectivity = ScoreSelectivity[
        configCache.ScoreUpdateThreshold
      ] as ScoreSelectivityKeys
      delete configCache.ScoreUpdateThreshold
    }

    if (configCache.TakeProfit) {
      configCache.ProfitLimit = configCache.TakeProfit
      delete configCache.TakeProfit
    }

    if (configCache.SellAtTakeProfit) {
      configCache.SellAtProfitLimit = configCache.SellAtTakeProfit
      delete configCache.SellAtTakeProfit
    }

    if (configCache.LossLimit) {
      configCache.StopLimit = configCache.LossLimit
      delete configCache.LossLimit
    }

    if (configCache.PriceAsset) {
      configCache.StableCoin = <StableUSDCoin>configCache.PriceAsset
      delete configCache.PriceAsset
    }

    this.cache.put(`Config`, JSON.stringify(configCache))

    return configCache
  }

  static getDefaultConfig(profile: Profile): Config {
    return {
      profile: profile,
      BuyQuantity: 10,
      StableCoin: StableUSDCoin.USDT,
      StopLimit: 0.05,
      ProfitLimit: 0.1,
      SellAtStopLimit: false,
      SellAtProfitLimit: true,
      SwingTradeEnabled: false,
      PriceProvider: PriceProvider.Binance,
      AveragingDown: false,
      ProfitBasedStopLimit: false,
      PriceAnomalyAlert: 5,
      ScoreSelectivity: `MODERATE`,
      AutoTradeBestScores: AutoTradeBestScores.OFF,
    }
  }

  setConfig(config: Config): void {
    this.set(`Config`, config)
    this.cache.put(`Config`, JSON.stringify(config))
  }

  delete(key: string) {
    key = `${this.profile.name}${key}`
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`)
    }
    // @ts-ignore
    this.source.removeData(key)
  }

  get(key: string): any {
    key = `${this.profile.name}${key}`
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`)
    }
    // @ts-ignore
    return this.source.getData(key)
  }

  getOrSet(key: string, value: any): any {
    return this.get(key) || this.set(key, value)
  }

  set(key: string, value: any): any {
    key = `${this.profile.name}${key}`
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`)
    }
    // @ts-ignore
    this.source.setData(key, value)
    return value
  }

  getTrades(): { [p: string]: TradeMemo } {
    const tradesCacheJson = this.cache.get(`Trades`)
    let tradesCache = tradesCacheJson ? JSON.parse(tradesCacheJson) : null
    if (!tradesCache) {
      tradesCache = this.getOrSet(`trade`, {})
      this.cache.put(`Trades`, JSON.stringify(tradesCache))
    }
    // Convert raw trades to TradeMemo objects
    return Object.keys(tradesCache).reduce((acc, key) => {
      acc[key] = TradeMemo.fromObject(tradesCache[key])
      return acc
    }, {})
  }

  getTradesList(state?: TradeState): TradeMemo[] {
    const values = Object.values(this.getTrades())
    return state ? values.filter((trade) => trade.stateIs(state)) : values
  }

  hasTrade(coinName: string): boolean {
    return !!this.getTrades()[coinName]
  }

  /**
   * changeTrade function provides a way to update the trade memo object.
   *
   * It locks the trade memo object for the duration of the mutation function but no more than 30 seconds.
   *
   * It expects a coinName and a mutate function. The mutate function receives either an existing trade memo object
   * from a store or if not found, calls the optional notFoundFn callback.
   *
   * Mutation function can return an updated trade memo object or undefined/null value.
   * If returned trade memo object has deleted flag set to true, this trade memo will be deleted.
   * If undefined/null value is returned, the trade memo will not be updated.
   *
   * @param coinName
   * @param mutateFn
   * @param notFoundFn?
   */
  changeTrade(
    coinName: string,
    mutateFn: (tm: TradeMemo) => TradeMemo | undefined | null,
    notFoundFn?: () => TradeMemo | undefined,
  ): void {
    coinName = coinName.toUpperCase()
    const lock = this.#acquireTradeLock(coinName)
    try {
      const trade = this.getTrades()[coinName]
      // if trade exists - get result from mutateFn, otherwise call notFoundFn if it was provided
      // otherwise changedTrade is null.
      const changedTrade = trade ? mutateFn(trade) : notFoundFn ? notFoundFn() : null

      if (changedTrade) {
        changedTrade.deleted ? this.deleteTrade(changedTrade) : this.setTrade(changedTrade)
      }
    } finally {
      lock.releaseLock()
    }
  }

  #acquireTradeLock(coinName: string): GoogleAppsScript.Lock.Lock {
    const lock = LockService.getScriptLock()
    try {
      execute({
        attempts: 4,
        interval: 1000, // 1 second
        runnable: () => lock.waitLock(5000), // 5 seconds
      })
      return lock
    } catch (e) {
      throw new Error(`Failed to acquire lock for ${coinName}: ${e.message}`)
    }
  }

  private setTrade(tradeMemo: TradeMemo) {
    const trades = this.getTrades()
    trades[tradeMemo.tradeResult.symbol.quantityAsset] = tradeMemo
    this.cache.put(`Trades`, JSON.stringify(trades))
  }

  private deleteTrade(tradeMemo: TradeMemo) {
    const trades = this.getTrades()
    delete trades[tradeMemo.tradeResult.symbol.quantityAsset]
    this.cache.put(`Trades`, JSON.stringify(trades))
  }

  dumpChanges() {
    const key = `FirebaseTradesSynced`
    if (!this.cache.get(key)) {
      this.set(`trade`, this.getTrades())
      // Sync trades with firebase every 5 minutes
      this.cache.put(key, `true`, 300)
    }
  }
}

export const DefaultProfileStore = new FirebaseStore(DefaultProfile)
