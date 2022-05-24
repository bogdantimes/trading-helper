import { Config, DefaultStore } from "./Store"
import { TradeActions } from "./TradeActions"
import { Statistics } from "./Statistics"
import { Exchange } from "./Exchange"
import { Survivors } from "./Survivors"
import { Log } from "./Common"
import { CoinScore, Stats } from "../shared-lib/types"
import { TradeMemo } from "../shared-lib/TradeMemo"
import { Process } from "./Process"
import { CacheProxy } from "./CacheProxy"

function doGet() {
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
    stop()
    ScriptApp.newTrigger(Process.tick.name).timeBased().everyMinutes(1).create()
    Log.info(`Started ${Process.tick.name}`)
  })
}

function stop() {
  catchError(() => {
    const trigger = ScriptApp.getProjectTriggers().find(t => t.getHandlerFunction() == Process.tick.name)
    if (trigger) {
      ScriptApp.deleteTrigger(trigger)
      Log.info(`Stopped ${Process.tick.name}`)
    }
  })
}

function catchError<T>(fn: () => T): T {
  try {
    const res = fn()
    Log.ifUsefulDumpAsEmail()
    return res
  } catch (e) {
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
  dbURL: string,
  binanceAPIKey: string,
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

function getTrades(): { [p: string]: TradeMemo } {
  return catchError(() => DefaultStore.getTrades())
}

function getStableCoins(): { [p: string]: number } {
  return catchError(() => {
    const raw = CacheProxy.get(CacheProxy.StableCoins)
    return raw ? JSON.parse(raw) : {}
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

function getSurvivors(): CoinScore[] {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    return new Survivors(DefaultStore, exchange).getScores()
  })
}

function resetSurvivors(): void {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    return new Survivors(DefaultStore, exchange).resetScores()
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
global.getStableCoins = getStableCoins
global.getConfig = getConfig
global.setConfig = setConfig
global.getStatistics = getStatistics
global.getSurvivors = getSurvivors
global.resetSurvivors = resetSurvivors
global.getCoinNames = getCoinNames
