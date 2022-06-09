import { DefaultStore } from "./Store"
import { TradeActions } from "./TradeActions"
import { Statistics } from "./Statistics"
import { Exchange } from "./Exchange"
import { IScores } from "./Scores"
import { Log, SECONDS_IN_MIN, TICK_INTERVAL_MIN } from "./Common"
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

/**
 * Check if the permanent storage is connected.
 * If yes, ensure the app is running in the background.
 * Otherwise, stop it.
 */
function checkDbConnectedAndAppRunning() {
  if (DefaultStore.isConnected()) {
    const processIsNotRunning = !ScriptApp.getProjectTriggers().find(
      (t) => t.getHandlerFunction() == Process.tick.name,
    )
    if (processIsNotRunning) startTicker()
  } else {
    Log.alert(`ℹ️ Database is not reachable.`)
    stopTicker()
  }
}

function doGet() {
  return catchError(() => {
    checkDbConnectedAndAppRunning()
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
    `ℹ️ Background process restarted. State synchronization interval is ${TICK_INTERVAL_MIN} minute.`,
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
      Log.alert(`🚫 Google API daily rate limit exceeded.`)
      const minutes = 5
      CacheProxy.put(skipNextTick, `true`, SECONDS_IN_MIN * minutes)
      Log.alert(`ℹ️ Background process paused for the next ${minutes} minutes.`)
    }
    Log.error(e)
    Log.ifUsefulDumpAsEmail()
    throw e
  }
}

function initialSetup(params: InitialSetupParams): string {
  return catchError(() => {
    if (!DefaultStore.isConnected()) {
      Log.alert(`✨ Initial setup`)
      Log.alert(`Connecting to Firebase with URL: ` + params.dbURL)
      DefaultStore.connect(params.dbURL)
      Log.alert(`Connected to Firebase`)
    }
    const config = DefaultStore.getConfig()
    config.KEY = params.binanceAPIKey || config.KEY
    config.SECRET = params.binanceSecretKey || config.SECRET
    if (config.KEY && config.SECRET) {
      Log.alert(`Checking if Binance is reachable`)
      new Exchange(config).getFreeAsset(config.StableCoin)
      Log.alert(`Connected to Binance`)
      startTicker()
    }
    DefaultStore.setConfig(config)
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
  return catchError(() => DefaultStore.getTradesList())
}

function getStableCoins(): Coin[] {
  return catchError(() => {
    const raw = CacheProxy.get(CacheProxy.StableCoins)
    return raw ? JSON.parse(raw) : []
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
    return DefaultStore.isConnected() ? DefaultStore.getConfig() : null
  })
}

function setConfig(config): string {
  return catchError(() => {
    DefaultStore.setConfig(config)
    return `Config updated`
  })
}

function getStatistics(): Stats {
  return catchError(() => new Statistics(DefaultStore).getAll())
}

function getScores(): ScoresData {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    const priceProvider = new PriceProvider(exchange, CacheProxy)
    const scores = global.TradingHelperScores.create(
      CacheProxy,
      DefaultStore,
      priceProvider,
    ) as IScores
    return scores.get()
  })
}

function resetScores(): void {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    const priceProvider = new PriceProvider(exchange, CacheProxy)
    const scores = global.TradingHelperScores.create(
      CacheProxy,
      DefaultStore,
      priceProvider,
    ) as IScores
    return scores.reset()
  })
}

function getCoinNames(): CoinName[] {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    const priceProvider = new PriceProvider(exchange, CacheProxy)
    return priceProvider.getCoinNames(DefaultStore.getConfig().StableCoin)
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
