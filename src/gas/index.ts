import { CachedStore, DefaultStore, FirebaseStore } from "./Store";
import { TradeActions } from "./TradeActions";
import { Statistics } from "./Statistics";
import { Exchange } from "./Exchange";
import { Log, SECONDS_IN_MIN, TICK_INTERVAL_MIN } from "./Common";
import {
  AppState,
  CoinName,
  Config,
  InitialSetupParams,
  IStore,
  MASK,
  PriceChannelsDataResponse,
} from "../lib";
import { Process } from "./Process";
import { CacheProxy } from "./CacheProxy";
import { TradesDao } from "./dao/Trades";
import { ConfigDao } from "./dao/Config";
import { ChannelsDao } from "./dao/Channels";
import { TradeManager } from "./TradeManager";
import { TrendProvider } from "./TrendProvider";
import { Upgrader } from "./Upgrader";
import HtmlOutput = GoogleAppsScript.HTML.HtmlOutput;

function doGet(): HtmlOutput {
  return catchError(() => {
    return (
      HtmlService.createTemplateFromFile(`index`)
        .evaluate()
        .addMetaTag(
          `viewport`,
          `width=device-width, initial-scale=1, maximum-scale=1`
        )
        // @ts-expect-error
        .setTitle(`TradingHelper v${VERSION}`)
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

function start(): string {
  return catchError(createTriggers);
}

function stop(): string {
  return catchError(deleteTriggers);
}

function createTriggers(): string {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(Process.tick.name)
    .timeBased()
    .everyMinutes(TICK_INTERVAL_MIN)
    .create();
  ScriptApp.newTrigger(Upgrader.OTAUpgrade.name)
    .timeBased()
    .everyHours(6)
    .create();
  Log.alert(
    `ℹ️ Background process started. State synchronization interval is ${TICK_INTERVAL_MIN} minute.`
  );
  // Low level unlock of all trades (in case of any issues with them).
  const ts = new TradesDao(DefaultStore).get();
  const locked = Object.keys(ts).filter((coinName) => ts[coinName].locked);
  if (locked.length) {
    locked.forEach((coinName) => ts[coinName].unlock());
    DefaultStore.set(`Trades`, ts);
    Log.alert(`ℹ️ Some trades were locked and are unlocked now`);
  }
  return `OK`;
}

function deleteTriggers(): string {
  let deleted = false;
  ScriptApp.getProjectTriggers().forEach((t) => {
    ScriptApp.deleteTrigger(t);
    deleted = true;
  });
  deleted && Log.alert(`⛔ Background processes stopped.`);
  return `OK`;
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
    let store: IStore = DefaultStore;
    if (params.dbURL) {
      const fbStore = new FirebaseStore();
      fbStore.connect(params.dbURL);
      Log.alert(`Connected to Firebase: ${params.dbURL}`);
      store = new CachedStore(fbStore, CacheProxy);
    }
    const configDao = new ConfigDao(store);
    const config = configDao.get();
    config.KEY = params.binanceAPIKey || config.KEY;
    config.SECRET = params.binanceSecretKey || config.SECRET;
    config.ViewOnly = params.viewOnly;
    if (config.ViewOnly || (config.KEY && config.SECRET)) {
      createTriggers();
    }
    configDao.set(config);
    Log.alert(`✨ Initial setup done.`);
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
    const trendProvider = new TrendProvider(
      configDao,
      new Exchange(config.KEY, config.SECRET),
      CacheProxy
    );
    config.AutoMarketTrend = trendProvider.get();
    config.KEY = config.KEY ? MASK : ``;
    config.SECRET = config.SECRET ? MASK : ``;
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
        .filter((a) => a.currentValue > 0 || a.tradeResult.soldPrice > 0),
      info: new Statistics(DefaultStore).getAll(),
      candidates: new ChannelsDao(DefaultStore).getCandidates(0),
      firebaseURL: FirebaseStore.url,
    };
  });
}

function buy(coin: CoinName): string {
  return catchError(() => {
    TradeManager.default().buy(coin.toUpperCase());
    return `${coin} was added to the buying queue`;
  });
}

function sell(coin: CoinName): string {
  return catchError(() => {
    TradeManager.default().sell(coin.toUpperCase());
    return `${coin} was added to the selling queue`;
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
global.setFirebaseURL = setFirebaseURL;
global.setPriceChannelsData = setPriceChannelsData;
global.getState = getState;
global.buy = buy;
global.sell = sell;
global.upgrade = () => catchError(Upgrader.OTAUpgrade);
