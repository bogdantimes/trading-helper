import { CacheProxy } from "./CacheProxy"
import {
  AutoTradeBestScores,
  Config,
  PriceProvider,
  ScoreSelectivity,
  StableUSDCoin,
  TradeMemo,
  TradeState,
} from "trading-helper-lib"
import { Log } from "./Common"

export class DeadlineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = `DeadlineError`
  }
}

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

  constructor() {
    if (this.url) {
      // @ts-ignore
      this.source = FirebaseApp.getDatabaseByUrl(this.url, ScriptApp.getOAuthToken())
    } else {
      Log.info(`Firebase Realtime Database is not connected.`)
      Log.info(`Google Apps Script property 'dbURL' is missing.`)
    }
    // If URL changed - clean trades and config cache
    const cachedURL = CacheProxy.get(`dbURL`)
    if (!!cachedURL && cachedURL !== this.url) {
      Log.alert(`Firebase Realtime Database URL changed.`)
      CacheProxy.remove(`Trades`)
      CacheProxy.remove(`Config`)
    }
    CacheProxy.put(`dbURL`, this.url)
  }

  get url(): string {
    return PropertiesService.getScriptProperties().getProperty(`dbURL`)
  }

  set url(url: string) {
    PropertiesService.getScriptProperties().setProperty(`dbURL`, url)
  }

  connect(dbURL: string) {
    // @ts-ignore
    this.source = FirebaseApp.getDatabaseByUrl(dbURL, ScriptApp.getOAuthToken())
    this.url = dbURL
  }

  isConnected(): boolean {
    return !!this.source
  }

  getConfig(): Config {
    const defaultConfig: Config = {
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
      ScoreUpdateThreshold: ScoreSelectivity.MODERATE,
      AutoTradeBestScores: AutoTradeBestScores.OFF,
    }
    const configCacheJson = CacheProxy.get(`Config`)
    let configCache: Config = configCacheJson ? JSON.parse(configCacheJson) : null
    if (!configCache) {
      configCache = this.getOrSet(`Config`, defaultConfig)
    }
    // apply existing config on top of default one
    configCache = Object.assign(defaultConfig, configCache)

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

    CacheProxy.put(`Config`, JSON.stringify(configCache))

    return configCache
  }

  setConfig(config: Config): void {
    this.set(`Config`, config)
    CacheProxy.put(`Config`, JSON.stringify(config))
  }

  delete(key: string) {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`)
    }
    // @ts-ignore
    this.source.removeData(key)
  }

  get(key: string): any {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`)
    }
    // @ts-ignore
    return this.source.getData(key)
  }

  getOrSet(key: string, value: any): any {
    const val = this.get(key) || value
    // @ts-ignore
    this.source.setData(key, val)
    return val
  }

  set(key: string, value: any): any {
    if (!this.isConnected()) {
      throw new Error(`Firebase is not connected.`)
    }
    // @ts-ignore
    this.source.setData(key, value)
    return value
  }

  getTrades(): { [p: string]: TradeMemo } {
    const tradesCacheJson = CacheProxy.get(`Trades`)
    let tradesCache = tradesCacheJson ? JSON.parse(tradesCacheJson) : null
    if (!tradesCache) {
      tradesCache = this.getOrSet(`trade`, {})
      CacheProxy.put(`Trades`, JSON.stringify(tradesCache))
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
    const key = `TradeLocker_${coinName}`
    try {
      while (CacheProxy.get(key)) Utilities.sleep(200)
      const deadline = 30 // Lock for 30 seconds to give a function enough time for com w/ Binance
      CacheProxy.put(key, `true`, deadline)

      const trade = this.getTrades()[coinName]
      // if trade exists - get result from mutateFn, otherwise call notFoundFn if it was provided
      // otherwise changedTrade is null.
      const changedTrade = trade ? mutateFn(trade) : notFoundFn ? notFoundFn() : null

      if (!CacheProxy.get(key)) {
        throw new DeadlineError(
          `Couldn't apply ${coinName} change within ${deadline} seconds deadline. Please, try again.`,
        )
      }

      if (changedTrade) {
        changedTrade.deleted ? this.deleteTrade(changedTrade) : this.setTrade(changedTrade)
      }
    } finally {
      CacheProxy.remove(key)
    }
  }

  private setTrade(tradeMemo: TradeMemo) {
    const trades = this.getTrades()
    trades[tradeMemo.tradeResult.symbol.quantityAsset] = tradeMemo
    CacheProxy.put(`Trades`, JSON.stringify(trades))
  }

  private deleteTrade(tradeMemo: TradeMemo) {
    const trades = this.getTrades()
    delete trades[tradeMemo.tradeResult.symbol.quantityAsset]
    CacheProxy.put(`Trades`, JSON.stringify(trades))
  }

  dumpChanges() {
    const key = `FirebaseTradesSynced`
    if (!CacheProxy.get(key)) {
      this.set(`trade`, this.getTrades())
      // Sync trades with firebase every 5 minutes
      CacheProxy.put(key, `true`, 300)
    }
  }
}

export const DefaultStore = new FirebaseStore()
