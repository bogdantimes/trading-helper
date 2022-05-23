import { Config, DefaultStore } from "./Store"
import { TradeActions } from "./TradeActions"
import { Statistics } from "./Statistics"
import { Exchange } from "./Exchange"
import { Survivors } from "./Survivors"
import { Log } from "./Common"
import { CoinScore, Stats } from "../shared-lib/types"
import { TradeMemo } from "../shared-lib/TradeMemo"
import { Process } from "./Process"

global.doGet = function doGet() {
  return HtmlService.createTemplateFromFile(`index`)
    .evaluate()
    .addMetaTag(`viewport`, `width=device-width, initial-scale=1, maximum-scale=1`)
}

global.doPost = function doPost() {
  return `404`
}

global.tick = function tick() {
  catchError(Process.tick)
}

global.start = function start() {
  catchError(() => {
    global.stop()
    ScriptApp.newTrigger(Process.tick.name).timeBased().everyMinutes(1).create()
    Log.info(`Started ${Process.tick.name}`)
  })
}

global.stop = function stop() {
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

global.initialSetup = function initialSetup(params: InitialSetupParams): string {
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
      // @ts-ignore
      Start()
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

global.buyCoin = function buyCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.buy(coinName)
    return `Buying ${coinName}`
  })
}

global.cancelAction = function cancelAction(coinName: string): string {
  return catchError(() => {
    TradeActions.cancel(coinName)
    return `Cancelling actions on ${coinName}`
  })
}

global.sellCoin = function sellCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.sell(coinName)
    return `Selling ${coinName}`
  })
}

global.setHold = function setHold(coinName: string, value: boolean): string {
  return catchError(() => {
    TradeActions.setHold(coinName, value)
    return `Setting HODL for ${coinName} to ${value}`
  })
}

global.dropCoin = function dropCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.drop(coinName)
    return `Removing ${coinName}`
  })
}

global.editTrade = function editTrade(coinName: string, newTradeMemo: TradeMemo): string {
  return catchError(() => {
    TradeActions.replace(coinName, TradeMemo.copy(newTradeMemo))
    return `Making changes for ${coinName}`
  })
}

global.getTrades = function getTrades(): { [p: string]: TradeMemo } {
  return catchError(() => DefaultStore.getTrades())
}

global.getConfig = function getConfig(): Config {
  return catchError(() => {
    return DefaultStore.isConnected() ? DefaultStore.getConfig() : null
  })
}

global.setConfig = function setConfig(config): string {
  return catchError(() => {
    DefaultStore.setConfig(config)
    return `Config updated`
  })
}

global.getStatistics = function getStatistics(): Stats {
  return catchError(() => new Statistics(DefaultStore).getAll())
}

global.getSurvivors = function getSurvivors(): CoinScore[] {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    return new Survivors(DefaultStore, exchange).getScores()
  })
}

global.resetSurvivors = function resetSurvivors(): void {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    return new Survivors(DefaultStore, exchange).resetScores()
  })
}

global.getCoinNames = function getCoinNames(): string[] {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig())
    return exchange.getCoinNames()
  })
}
