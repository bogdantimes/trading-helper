import { DefaultStore, FirebaseStore, IStore } from "./Store"
import { TradeActions } from "./TradeActions"
import { Statistics } from "./Statistics"
import { Exchange } from "./Exchange"
import { IScores } from "./Scores"
import { Log, SECONDS_IN_MIN, StableCoins, TICK_INTERVAL_MIN } from "./Common"
import {
  AssetsResponse,
  Coin,
  CoinName,
  Config,
  InitialSetupParams,
  ScoresData,
  Stats,
  TradeMemo,
} from "trading-helper-lib"
import { Process } from "./Process"
import { CacheProxy } from "./CacheProxy"
import { PriceProvider } from "./PriceProvider"
import { TradesDao } from "./dao/Trades"
import { ConfigDao } from "./dao/Config"

function doGet() {
  return catchError(() => {
    return HtmlService.createTemplateFromFile(`index`)
      .evaluate()
      .addMetaTag(`viewport`, `width=device-width, initial-scale=1, maximum-scale=1`)
  })
}

function doPost() {
  return `404`
}

const skipNextTick = `skipNextTick`

function tick() {
  catchError(() => {
    if (CacheProxy.get(skipNextTick)) return
    Process.tick()
  })
}

function start() {
  catchError(startTicker)
}

function stop() {
  catchError(stopTicker)
}

function startTicker() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger(Process.tick.name).timeBased().everyMinutes(TICK_INTERVAL_MIN).create()
  Log.alert(
    `ℹ️ Background process started. State synchronization interval is ${TICK_INTERVAL_MIN} minute.`,
  )
}

function stopTicker() {
  let deleted = false
  ScriptApp.getProjectTriggers().forEach((t) => {
    ScriptApp.deleteTrigger(t)
    deleted = true
  })
  deleted && Log.alert(`⛔ Background processes stopped.`)
}

function catchError<T>(fn: () => T): T {
  try {
    const res = fn()
    Log.ifUsefulDumpAsEmail()
    return res
  } catch (e) {
    const limitMsg1 = `Service invoked too many times`
    const limitMsg2 = `Please wait a bit and try again`
    if (e.message.includes(limitMsg1) || e.message.includes(limitMsg2)) {
      // If limit already handled, just throw the error without logging
      if (CacheProxy.get(skipNextTick)) throw e
      // Handle limit gracefully
      Log.alert(`ℹ️Google API daily rate limit exceeded.`)
      const minutes = 5
      CacheProxy.put(skipNextTick, `true`, SECONDS_IN_MIN * minutes)
      Log.alert(`ℹ️Background process paused for the next ${minutes} minutes.`)
    }
    Log.error(e)
    Log.ifUsefulDumpAsEmail()
    throw e
  }
}

function initialSetup(params: InitialSetupParams): string {
  return catchError(() => {
    Log.alert(`✨ Initial setup`)
    let store: IStore = DefaultStore
    if (params.dbURL) {
      const fbStore = new FirebaseStore()
      fbStore.connect(params.dbURL)
      Log.alert(`Connected to Firebase: ${params.dbURL}`)
      store = fbStore
    }
    const configDao = new ConfigDao(store)
    const config = configDao.get()
    config.KEY = params.binanceAPIKey || config.KEY
    config.SECRET = params.binanceSecretKey || config.SECRET
    if (config.KEY && config.SECRET) {
      Log.alert(`Checking if Binance is reachable`)
      new Exchange(config).getFreeAsset(config.StableCoin)
      Log.alert(`Connected to Binance`)
      startTicker()
    }
    configDao.set(config)
    return `OK`
  })
}

function buyCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.default().buy(coinName)
    return `Buying ${coinName}`
  })
}

function cancelAction(coinName: string): string {
  return catchError(() => {
    TradeActions.default().cancel(coinName)
    return `Cancelling actions on ${coinName}`
  })
}

function sellCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.default().sell(coinName)
    return `Selling ${coinName}`
  })
}

function setHold(coinName: string, value: boolean): string {
  return catchError(() => {
    TradeActions.default().setHold(coinName, value)
    return `Setting HODL for ${coinName} to ${value}`
  })
}

function dropCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.default().drop(coinName)
    return `Removing ${coinName}`
  })
}

function editTrade(coinName: string, newTradeMemo: TradeMemo): string {
  return catchError(() => {
    TradeActions.default().replace(coinName, TradeMemo.copy(newTradeMemo))
    return `Making changes for ${coinName}`
  })
}

function getTrades(): TradeMemo[] {
  return catchError(() => new TradesDao(DefaultStore).getList())
}

function getStableCoins(): Coin[] {
  return catchError(() => {
    return DefaultStore.get(StableCoins) || []
  })
}

function getAssets(): AssetsResponse {
  return catchError(() => {
    return {
      trades: getTrades(),
      stableCoins: getStableCoins(),
    }
  })
}

function getConfig(): Config {
  return catchError(() => {
    const configDao = new ConfigDao(DefaultStore)
    return configDao.isInitialized() ? configDao.get() : null
  })
}

function setConfig(config): string {
  return catchError(() => {
    new ConfigDao(DefaultStore).set(config)
    return `Config updated`
  })
}

function getStatistics(): Stats {
  return catchError(() => new Statistics(DefaultStore).getAll())
}

function getScores(): ScoresData {
  return catchError(() => {
    const config = new ConfigDao(DefaultStore).get()
    const exchange = new Exchange(config)
    const priceProvider = PriceProvider.getInstance(exchange, CacheProxy)
    const scores = global.TradingHelperScores.create(DefaultStore, priceProvider, config) as IScores
    return scores.get()
  })
}

function resetScores(): void {
  return catchError(() => {
    const config = new ConfigDao(DefaultStore).get()
    const exchange = new Exchange(config)
    const priceProvider = PriceProvider.getInstance(exchange, CacheProxy)
    const scores = global.TradingHelperScores.create(DefaultStore, priceProvider, config) as IScores
    return scores.reset()
  })
}

function getCoinNames(): CoinName[] {
  return catchError(() => {
    const config = new ConfigDao(DefaultStore).get()
    const exchange = new Exchange(config)
    const priceProvider = PriceProvider.getInstance(exchange, CacheProxy)
    return priceProvider.getCoinNames(config.StableCoin)
  })
}

function getFirebaseURL(): string {
  return catchError(() => FirebaseStore.url)
}

function setFirebaseURL(url: string): string {
  return catchError(() => {
    if (url) {
      new FirebaseStore().connect(url)
      Log.alert(`Connected to Firebase: ${url}`)
      return `OK`
    } else {
      new FirebaseStore().disconnect()
      Log.alert(`Disconnected from Firebase`)
      return `OK`
    }
  })
}

global.doGet = doGet
global.doPost = doPost
global.tick = tick
global.start = start
global.stop = stop
global.initialSetup = initialSetup
global.buyCoin = buyCoin
global.cancelAction = cancelAction
global.sellCoin = sellCoin
global.setHold = setHold
global.dropCoin = dropCoin
global.editTrade = editTrade
global.getTrades = getTrades
global.getAssets = getAssets
global.getStableCoins = getStableCoins
global.getConfig = getConfig
global.setConfig = setConfig
global.getStatistics = getStatistics
global.getScores = getScores
global.resetScores = resetScores
global.getCoinNames = getCoinNames
global.getFirebaseURL = getFirebaseURL
global.setFirebaseURL = setFirebaseURL
