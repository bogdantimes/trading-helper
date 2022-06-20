import { DefaultProfileStore, FirebaseStore } from "./Store"
import { TradeActions } from "./TradeActions"
import { Statistics } from "./Statistics"
import { Exchange } from "./Exchange"
import { IScores } from "./Scores"
import { Log, SECONDS_IN_MIN, TICK_INTERVAL_MIN } from "./Common"
import {
  AssetsResponse,
  AutoTradeBestScores,
  Coin,
  CoinName,
  Config,
  enumKeys,
  InitialSetupParams,
  Profile,
  ScoresData,
  ScoreSelectivity,
  ScoreSelectivityKeys,
  Stats,
  TradeMemo,
} from "trading-helper-lib"
import { Process } from "./Process"
import { DefaultProfileCacheProxy } from "./CacheProxy"
import { PriceProvider } from "./PriceProvider"

/**
 * Check if the permanent storage is connected.
 * If yes, ensure the app is running in the background.
 * Otherwise, stop it.
 */
function checkDbConnectedAndAppRunning() {
  if (DefaultProfileStore.isConnected()) {
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
    if (DefaultProfileCacheProxy.get(skipNextTick)) return
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
      if (DefaultProfileCacheProxy.get(skipNextTick)) throw e
      // Handle limit gracefully
      Log.alert(`ℹ️ Google API daily rate limit exceeded.`)
      const minutes = 5
      DefaultProfileCacheProxy.put(skipNextTick, `true`, SECONDS_IN_MIN * minutes)
      Log.alert(`ℹ️ Background process paused for the next ${minutes} minutes.`)
    }
    Log.error(e)
    Log.ifUsefulDumpAsEmail()
    throw e
  }
}

function initialSetup(params: InitialSetupParams): string {
  return catchError(() => {
    if (!DefaultProfileStore.isConnected()) {
      Log.alert(`✨ Initial setup`)
      Log.alert(`Connecting to Firebase with URL: ` + params.dbURL)
      DefaultProfileStore.connect(params.dbURL)
      Log.alert(`Connected to Firebase`)
    }
    const config = DefaultProfileStore.getConfig()
    config.KEY = params.binanceAPIKey || config.KEY
    config.SECRET = params.binanceSecretKey || config.SECRET
    if (config.KEY && config.SECRET) {
      Log.alert(`Checking if Binance is reachable`)
      new Exchange(config).getFreeAsset(config.StableCoin)
      Log.alert(`Connected to Binance`)
      startTicker()
    }
    DefaultProfileStore.setConfig(config)
    return `OK`
  })
}

function buyCoin(coinName: string, profile: Profile): string {
  return catchError(() => {
    const store = new FirebaseStore(profile)
    TradeActions.default(store).buy(coinName)
    return `Buying ${coinName}`
  })
}

function cancelAction(coinName: string, profile: Profile): string {
  return catchError(() => {
    const store = new FirebaseStore(profile)
    TradeActions.default(store).cancel(coinName)
    return `Cancelling actions on ${coinName}`
  })
}

function sellCoin(coinName: string, profile: Profile): string {
  return catchError(() => {
    const store = new FirebaseStore(profile)
    TradeActions.default(store).sell(coinName)
    return `Selling ${coinName}`
  })
}

function setHold(coinName: string, value: boolean, profile: Profile): string {
  return catchError(() => {
    const store = new FirebaseStore(profile)
    TradeActions.default(store).setHold(coinName, value)
    return `Setting HODL for ${coinName} to ${value}`
  })
}

function dropCoin(coinName: string, profile: Profile): string {
  return catchError(() => {
    const store = new FirebaseStore(profile)
    TradeActions.default(store).drop(coinName)
    return `Removing ${coinName}`
  })
}

function editTrade(coinName: string, newTradeMemo: TradeMemo, profile: Profile): string {
  return catchError(() => {
    const store = new FirebaseStore(profile)
    TradeActions.default(store).replace(coinName, TradeMemo.copy(newTradeMemo))
    return `Making changes for ${coinName}`
  })
}

function getStableCoins(): Coin[] {
  return catchError(() => {
    const raw = DefaultProfileCacheProxy.get(DefaultProfileCacheProxy.StableCoins)
    return raw ? JSON.parse(raw) : []
  })
}

function getAssets(profile: Profile): AssetsResponse {
  return catchError(() => {
    return {
      trades: new FirebaseStore(profile).getTradesList(),
      stableCoins: getStableCoins(),
    }
  })
}

function getConfig(profile: Profile): Config {
  return catchError(() => {
    const store = profile ? new FirebaseStore(profile) : DefaultProfileStore
    return store.isConnected() ? store.getConfig() : null
  })
}

function setConfig(config): string {
  return catchError(() => {
    const store = new FirebaseStore(config.profile)
    store.setConfig(config)
    return `Config updated`
  })
}

function getStatistics(profile: Profile): Stats {
  const store = new FirebaseStore(profile)
  return catchError(() => new Statistics(store).getAll())
}

function getScores(profile: Profile): ScoresData {
  return catchError(() => {
    const store = new FirebaseStore(profile)
    const exchange = new Exchange(store.getConfig())
    const priceProvider = PriceProvider.getInstance(exchange, DefaultProfileCacheProxy)
    const scores = global.TradingHelperScores.create(
      DefaultProfileCacheProxy,
      store,
      priceProvider,
    ) as IScores
    return scores.get()
  })
}

function resetScores(profile: Profile): void {
  return catchError(() => {
    const store = new FirebaseStore(profile)
    const exchange = new Exchange(store.getConfig())
    const priceProvider = PriceProvider.getInstance(exchange, DefaultProfileCacheProxy)
    const scores = global.TradingHelperScores.create(
      DefaultProfileCacheProxy,
      store,
      priceProvider,
    ) as IScores
    return scores.reset()
  })
}

function getCoinNames(profile: Profile): CoinName[] {
  return catchError(() => {
    const store = new FirebaseStore(profile)
    const exchange = new Exchange(store.getConfig())
    const priceProvider = PriceProvider.getInstance(exchange, DefaultProfileCacheProxy)
    return priceProvider.getCoinNames(store.getConfig().StableCoin)
  })
}

function getProfiles(): { [key: string]: Profile } {
  return catchError(() => {
    return FirebaseStore.getProfiles()
  })
}

const commonParams = {
  BuyQuantity: 11,
  SellAtProfitLimit: false,
  SellAtStopLimit: true,
  StopLimit: 0.03,
  ProfitLimit: 0.06,
  PriceAnomalyAlert: 15,
}

function profile1() {
  const profile = { name: `ModerateTop5` }
  const profileConfig = FirebaseStore.newProfileConfig(profile)
  Object.assign(profileConfig, commonParams)
  profileConfig.ScoreSelectivity = `MODERATE`
  profileConfig.AutoTradeBestScores = AutoTradeBestScores.TOP5
  profileConfig.SwingTradeEnabled = true
  return profileConfig
}

function profile2() {
  const profile = { name: `ModerateTop10` }
  const profileConfig = FirebaseStore.newProfileConfig(profile)
  Object.assign(profileConfig, commonParams)
  profileConfig.ScoreSelectivity = `MODERATE`
  profileConfig.AutoTradeBestScores = AutoTradeBestScores.TOP10
  return profileConfig
}

function profile3() {
  const profile = { name: `MinimalTop5` }
  const profileConfig = FirebaseStore.newProfileConfig(profile)
  Object.assign(profileConfig, commonParams)
  profileConfig.ScoreSelectivity = `MINIMAL`
  profileConfig.AutoTradeBestScores = AutoTradeBestScores.TOP5
  profileConfig.ProfitLimit = 0.03
  profileConfig.SwingTradeEnabled = true
  return profileConfig
}

function profile4() {
  const profile = { name: `HighTop5` }
  const profileConfig = FirebaseStore.newProfileConfig(profile)
  Object.assign(profileConfig, commonParams)
  profileConfig.ScoreSelectivity = `HIGH`
  profileConfig.AutoTradeBestScores = AutoTradeBestScores.TOP5
  profileConfig.StopLimit = 0.06
  profileConfig.ProfitLimit = 0.12
  profileConfig.SwingTradeEnabled = true
  return profileConfig
}

function profile5() {
  const profile = { name: `PnD7` }
  const profileConfig = FirebaseStore.newProfileConfig(profile)
  Object.assign(profileConfig, commonParams)
  profileConfig.PriceAnomalyAlert = 7
  profileConfig.BuyDumps = true
  profileConfig.SellPumps = true
  return profileConfig
}

function profile6(): Config {
  const profile = { name: `PnD10` }
  const profileConfig = FirebaseStore.newProfileConfig(profile)
  Object.assign(profileConfig, commonParams)
  profileConfig.PriceAnomalyAlert = 10
  profileConfig.BuyDumps = true
  profileConfig.SellPumps = true
  return profileConfig
}

function createAutoTradeProfiles(): void {
  return catchError(() => {
    function create(config: Config) {
      FirebaseStore.createProfile(config.profile, config)
      Log.alert(`Created profile ${config.profile.name}`)
    }

    create(profile1())
    create(profile2())
    create(profile3())
    create(profile4())
    create(profile5())
    create(profile6())
  })
}

function deleteAutoTradeProfiles(): void {
  return catchError(() => {
    function deleteProf(config: Config) {
      FirebaseStore.deleteProfile(config.profile)
      Log.alert(`Deleted profile ${config.profile.name}`)
    }

    deleteProf(profile1())
    deleteProf(profile2())
    deleteProf(profile3())
    deleteProf(profile4())
    deleteProf(profile5())
    deleteProf(profile6())

    DefaultProfileCacheProxy.remove(`Profiles`)
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
global.getAssets = getAssets
global.getStableCoins = getStableCoins
global.getConfig = getConfig
global.setConfig = setConfig
global.getStatistics = getStatistics
global.getScores = getScores
global.resetScores = resetScores
global.getCoinNames = getCoinNames
global.getProfiles = getProfiles
global.createAutoTradeProfiles = createAutoTradeProfiles
global.deleteAutoTradeProfiles = deleteAutoTradeProfiles
