import { Config, DefaultStore } from "./Store"
import { TradeActions } from "./TradeActions"
import { Statistics } from "./Statistics"
import { Exchange } from "./Exchange"
import { Scores } from "./Scores"
import { Log, SECONDS_IN_HOUR } from "./Common"
import { Coin, Stats } from "../shared-lib/types"
import { TradeMemo } from "../shared-lib/TradeMemo"
import { Process } from "./Process"
import { CacheProxy } from "./CacheProxy"
import { AssetsResponse, ScoresResponse } from "../shared-lib/responses"

const TICK_INTERVAL = 1
const SLOW_TICK_INTERVAL = 5

function doGet() {
  if (!ScriptApp.getProjectTriggers().find((t) => t.getHandlerFunction() == Process.tick.name)) {
    // Start app if not running
    start()
  }
  return HtmlService.createTemplateFromFile(`index`)
    .evaluate()
    .addMetaTag(`viewport`, `width=device-width, initial-scale=1, maximum-scale=1`)
}

function doPost() {
  return `404`
}

function tick() {
  catchError(Process.tick)
}

function start() {
  catchError(() => {
    ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t))
    ScriptApp.newTrigger(Process.tick.name).timeBased().everyMinutes(TICK_INTERVAL).create()
    Log.alert(
      `Background process restarted. State synchronization interval is ${TICK_INTERVAL} minute.`,
    )
  })
}

function stop() {
  catchError(() => {
    let deleted = false
    ScriptApp.getProjectTriggers().forEach((t) => {
      ScriptApp.deleteTrigger(t)
      deleted = true
    })
    deleted && Log.alert(`Background processes stopped.`)
  })
}

function slowDownTemporarily(durationSec: number) {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger(Process.tick.name).timeBased().everyMinutes(SLOW_TICK_INTERVAL).create()
  ScriptApp.newTrigger(start.name)
    .timeBased()
    .after(durationSec * 1000)
    .create()
}

function catchError<T>(fn: () => T): T {
  try {
    const res = fn()
    Log.ifUsefulDumpAsEmail()
    return res
  } catch (e) {
    if (e.message.includes(`Service invoked too many times`)) {
      if (CacheProxy.get(`TickSlowedDown`)) return
      Log.alert(`Google API daily rate limit exceeded.`)
      slowDownTemporarily(SECONDS_IN_HOUR)
      CacheProxy.put(`TickSlowedDown`, `true`, SECONDS_IN_HOUR)
      Log.alert(`Background process interval slowed down for the next hour.`)
    }
    Log.error(e)
    Log.ifUsefulDumpAsEmail()
    throw e
  }
}

function initialSetup(params: InitialSetupParams): string {
  return catchError(() => {
    if (params.dbURL) {
      Log.alert(`Initial setup`)
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
      start()
    }
    DefaultStore.setConfig(config)
    return `OK`
  })
}

export type InitialSetupParams = {
  dbURL: string
  binanceAPIKey: string
  binanceSecretKey: string
}

function buyCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.buy(coinName)
    return `Buying ${coinName}`
  })
}

function cancelAction(coinName: string): string {
  return catchError(() => {
    TradeActions.cancel(coinName)
    return `Cancelling actions on ${coinName}`
  })
}

function sellCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.sell(coinName)
    return `Selling ${coinName}`
  })
}

function setHold(coinName: string, value: boolean): string {
  return catchError(() => {
    TradeActions.setHold(coinName, value)
    return `Setting HODL for ${coinName} to ${value}`
  })
}

function dropCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.drop(coinName)
    return `Removing ${coinName}`
  })
}

function editTrade(coinName: string, newTradeMemo: TradeMemo): string {
  return catchError(() => {
    TradeActions.replace(coinName, TradeMemo.copy(newTradeMemo))
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

function getScores(): ScoresResponse {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    const scoresManager = new Scores(DefaultStore, exchange)
    return {
      recommended: scoresManager.getRecommended(),
      marketMove: scoresManager.getMarketMove(),
    }
  })
}

function resetScores(): void {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    return new Scores(DefaultStore, exchange).reset()
  })
}

function getCoinNames(): string[] {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    return exchange.getCoinNames()
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
