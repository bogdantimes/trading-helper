import { DefaultStore, FirebaseStore } from "./Store";
import { TradeActions } from "./TradeActions";
import { Statistics } from "./Statistics";
import { Exchange } from "./Exchange";
import { Log, SECONDS_IN_MIN, TICK_INTERVAL_MIN } from "./Common";
import {
  AppState,
  Config,
  InitialSetupParams,
  IStore,
  PriceChannelsDataResponse,
} from "../lib";
import { Process } from "./Process";
import { CacheProxy } from "./CacheProxy";
import { TradesDao } from "./dao/Trades";
import { ConfigDao } from "./dao/Config";
import { ChannelsDao } from "./dao/Channels";
import { TradeManager } from "./TradeManager";
import { FGIProvider } from "./FGIProvider";
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
  catchError(createTriggers);
}

function stop(): void {
  catchError(deleteTriggers);
}

function createTriggers(): void {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(Process.tick.name)
    .timeBased()
    .everyMinutes(TICK_INTERVAL_MIN)
    .create();
  Log.alert(
    `ℹ️ Background process started. State synchronization interval is ${TICK_INTERVAL_MIN} minute.`
  );
}

function deleteTriggers(): void {
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
      createTriggers();
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

function setConfig(config): string {
  return catchError(() => {
    new ConfigDao(DefaultStore).set(config);
    return `Config updated`;
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

function setPriceChannelsData(data: PriceChannelsDataResponse): string {
  return catchError(() => {
    new ChannelsDao(DefaultStore).setAll(data);
    return `OK`;
  });
}

function getConfig(): Config {
  const configDao = new ConfigDao(DefaultStore);
  if (configDao.isInitialized()) {
    const config = configDao.get();
    const fgi = new FGIProvider(
      configDao,
      new Exchange(config.KEY, config.SECRET),
      CacheProxy
    );
    config.AutoFGI = fgi.get();
    return config;
  } else {
    return null;
  }
}

/**
 * Returns the aggregated state for the UI:
 * trades, config, statistics, candidates
 */
function getState(): AppState {
  return catchError<AppState>(() => {
    const config = getConfig();
    return {
      config,
      assets: new TradesDao(DefaultStore)
        .getList()
        .filter((a) => a.tradeResult.quantity > 0),
      info: new Statistics(DefaultStore).getAll(),
      candidates: new ChannelsDao(DefaultStore).getCandidates(0.5),
    };
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
global.setConfig = setConfig;
global.getFirebaseURL = getFirebaseURL;
global.setFirebaseURL = setFirebaseURL;
global.setPriceChannelsData = setPriceChannelsData;
global.getState = getState;
