import { DefaultStore, FirebaseStore } from "./Store";
import { TradeActions } from "./TradeActions";
import { Statistics } from "./Statistics";
import { Exchange } from "./Exchange";
import { Log, SECONDS_IN_MIN, TICK_INTERVAL_MIN } from "./Common";
import {
  AssetsResponse,
  CoinName,
  Config,
  InitialSetupParams,
  IStore,
  PriceChannelsDataResponse,
  Stats,
  TradeMemo,
} from "../lib";
import { Process } from "./Process";
import { CacheProxy } from "./CacheProxy";
import { PriceProvider } from "./priceprovider/PriceProvider";
import { TradesDao } from "./dao/Trades";
import { ConfigDao } from "./dao/Config";
import { ChannelsDao } from "./dao/Channels";
import { TradeManager } from "./TradeManager";
import HtmlOutput = GoogleAppsScript.HTML.HtmlOutput;

function doGet(): HtmlOutput {
  return catchError(() => {
    return HtmlService.createTemplateFromFile(`index`)
      .evaluate()
      .addMetaTag(
        `viewport`,
        `width=device-width, initial-scale=1, maximum-scale=1`
      );
  });
}

function doPost(): HtmlOutput {
  return HtmlService.createHtmlOutput().setTitle(`Not found`);
}

const skipNextTick = `skipNextTick`;

function tick(): void {
  catchError(() => {
    if (CacheProxy.get(skipNextTick)) return;
    Process.tick();
  });
}

function start(): void {
  catchError(startTicker);
}

function stop(): void {
  catchError(stopTicker);
}

function startTicker(): void {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(Process.tick.name)
    .timeBased()
    .everyMinutes(TICK_INTERVAL_MIN)
    .create();
  Log.alert(
    `ℹ️ Background process started. State synchronization interval is ${TICK_INTERVAL_MIN} minute.`
  );
}

function stopTicker(): void {
  let deleted = false;
  ScriptApp.getProjectTriggers().forEach((t) => {
    ScriptApp.deleteTrigger(t);
    deleted = true;
  });
  deleted && Log.alert(`⛔ Background processes stopped.`);
}

function catchError<T>(fn: () => T): T {
  try {
    const res = fn();
    Log.ifUsefulDumpAsEmail();
    return res;
  } catch (e) {
    const limitMsg1 = `Service invoked too many times`;
    const limitMsg2 = `Please wait a bit and try again`;
    if (e.message.includes(limitMsg1) || e.message.includes(limitMsg2)) {
      // If limit already handled, just throw the error without logging
      if (CacheProxy.get(skipNextTick)) throw e;
      // Handle limit gracefully
      Log.alert(`ℹ️Google API daily rate limit exceeded.`);
      const minutes = 5;
      CacheProxy.put(skipNextTick, `true`, SECONDS_IN_MIN * minutes);
      Log.alert(`ℹ️Background process paused for the next ${minutes} minutes.`);
    }
    Log.error(e);
    Log.ifUsefulDumpAsEmail();
    throw e;
  }
}

function initialSetup(params: InitialSetupParams): string {
  return catchError(() => {
    Log.alert(`✨ Initial setup`);
    let store: IStore = DefaultStore;
    if (params.dbURL) {
      const fbStore = new FirebaseStore();
      fbStore.connect(params.dbURL);
      Log.alert(`Connected to Firebase: ${params.dbURL}`);
      store = fbStore;
    }
    const configDao = new ConfigDao(store);
    const config = configDao.get();
    config.KEY = params.binanceAPIKey || config.KEY;
    config.SECRET = params.binanceSecretKey || config.SECRET;
    if (config.KEY && config.SECRET) {
      Log.alert(`Checking if Binance is reachable`);
      new Exchange(config.KEY, config.SECRET).getBalance(config.StableCoin);
      Log.alert(`Connected to Binance`);
      startTicker();
    }
    configDao.set(config);
    return `OK`;
  });
}

function sellAll(): string {
  return catchError(() => {
    TradeManager.default().sellAll();
    return `Selling all`;
  });
}

function dropCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.default().drop(coinName);
    return `Removing ${coinName}`;
  });
}

function getTrades(): TradeMemo[] {
  return catchError(() => new TradesDao(DefaultStore).getList());
}

function getAssets(): AssetsResponse {
  return catchError(() => {
    return {
      trades: getTrades(),
    };
  });
}

function getConfig(): Config {
  return catchError(() => {
    const configDao = new ConfigDao(DefaultStore);
    return configDao.isInitialized() ? configDao.get() : null;
  });
}

function setConfig(config): string {
  return catchError(() => {
    new ConfigDao(DefaultStore).set(config);
    return `Config updated`;
  });
}

function getStatistics(): Stats {
  return catchError(() => new Statistics(DefaultStore).getAll());
}

function getCoinNames(): CoinName[] {
  return catchError(() => {
    const config = new ConfigDao(DefaultStore).get();
    const exchange = new Exchange(config.KEY, config.SECRET);
    const priceProvider = PriceProvider.default(exchange, CacheProxy);
    return priceProvider.getCoinNames(config.StableCoin);
  });
}

function getFirebaseURL(): string {
  return catchError(() => FirebaseStore.url);
}

function setFirebaseURL(url: string): string {
  return catchError(() => {
    if (url) {
      new FirebaseStore().connect(url);
      Log.alert(`Connected to Firebase: ${url}`);
      return `OK`;
    } else {
      new FirebaseStore().disconnect();
      Log.alert(`Disconnected from Firebase`);
      return `OK`;
    }
  });
}

function getPriceChannelsData(): PriceChannelsDataResponse {
  return catchError(() => {
    return new ChannelsDao(DefaultStore).getAll();
  });
}

function setPriceChannelsData(data: PriceChannelsDataResponse): string {
  return catchError(() => {
    new ChannelsDao(DefaultStore).setAll(data);
    return `OK`;
  });
}

global.doGet = doGet;
global.doPost = doPost;
global.tick = tick;
global.start = start;
global.stop = stop;
global.initialSetup = initialSetup;
global.sellAll = sellAll;
global.dropCoin = dropCoin;
global.getTrades = getTrades;
global.getAssets = getAssets;
global.getConfig = getConfig;
global.setConfig = setConfig;
global.getStatistics = getStatistics;
global.getCoinNames = getCoinNames;
global.getFirebaseURL = getFirebaseURL;
global.setFirebaseURL = setFirebaseURL;
global.getPriceChannelsData = getPriceChannelsData;
global.setPriceChannelsData = setPriceChannelsData;
