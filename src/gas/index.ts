import { CachedStore, DefaultStore, FirebaseStore } from "./Store";
import { TradeActions } from "./TradeActions";
import { Statistics } from "./Statistics";
import { Exchange } from "./Exchange";
import { Log, SECONDS_IN_MIN, TICK_INTERVAL_MIN } from "./Common";
import {
  type AppState,
  type CoinName,
  type Config,
  type InitialSetupParams,
  type IStore,
  MASK,
} from "../lib";
import { Process } from "./Process";
import { CacheProxy } from "./CacheProxy";
import { TradesDao } from "./dao/Trades";
import { ConfigDao } from "./dao/Config";
import { ChannelsDao } from "./dao/Channels";
import { TradeManager } from "./TradeManager";
import { TrendProvider } from "./TrendProvider";
import { Updater, UpgradeDone } from "./Updater";
import { type TraderPlugin } from "./traders/plugin/api";
import { WithdrawalsManager } from "./WithdrawalsManager";
import HtmlOutput = GoogleAppsScript.HTML.HtmlOutput;

function doGet(): HtmlOutput {
  return catchError(() => {
    return (
      HtmlService.createTemplateFromFile(`index`)
        .evaluate()
        .setFaviconUrl(
          `https://user-images.githubusercontent.com/7527778/167810306-0b882d1b-64b0-4fab-b647-9c3ef01e46b4.png`
        )
        .addMetaTag(
          `viewport`,
          `width=device-width, initial-scale=1, maximum-scale=1`
        )
        // @ts-expect-error VERSION is injected by esbuild
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
  return catchError(startAllProcesses);
}

function stop(): string {
  return catchError(stopTradingProcess);
}

function startAllProcesses(): string {
  ScriptApp.getProjectTriggers().forEach((t) => {
    ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(Process.tick.name)
    .timeBased()
    .everyMinutes(TICK_INTERVAL_MIN)
    .create();
  ScriptApp.newTrigger(Updater.upgrade.name).timeBased().everyHours(6).create();
  ScriptApp.newTrigger(DefaultStore.keepCacheAlive.name)
    .timeBased()
    .everyHours(3)
    .create();
  Log.alert(
    `ℹ️ Background processes started. State synchronization interval is ${TICK_INTERVAL_MIN} minute.`
  );
  // Low level unlock of all trades (in case of any issues with them).
  const ts = new TradesDao(DefaultStore).get();
  const locked = Object.keys(ts).filter((coinName) => ts[coinName].locked);
  if (locked.length) {
    locked.forEach((coinName) => {
      ts[coinName].unlock();
    });
    DefaultStore.set(`Trades`, ts);
    Log.alert(`ℹ️ Some trades were locked and are unlocked now`);
  }
  return `OK`;
}

function stopTradingProcess(): string {
  let deleted = false;
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === Process.tick.name) {
      ScriptApp.deleteTrigger(t);
      deleted = true;
    }
  });
  deleted && Log.alert(`⛔ Trading process stopped.`);
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
    config.KEY = params.binanceAPIKey ?? config.KEY;
    config.SECRET = params.binanceSecretKey ?? config.SECRET;
    config.ViewOnly = params.viewOnly;
    if (config.ViewOnly || (config.KEY && config.SECRET)) {
      startAllProcesses();
    }
    configDao.set(config);
    Log.alert(`✨ Initial setup done.`);
    return `OK`;
  });
}

function sellAll(): string {
  return catchError(() => {
    TradeManager.default().sellAll();
    return `Done. Results were sent to your email.`;
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

function getConfig(): Config {
  const configDao = new ConfigDao(DefaultStore);
  const config = configDao.get();
  const trendProvider = new TrendProvider(
    configDao,
    new Exchange(configDao),
    CacheProxy
  );
  config.AutoMarketTrend = trendProvider.get();
  config.KEY = config.KEY ? MASK : ``;
  config.SECRET = config.SECRET ? MASK : ``;
  return config;
}

/**
 * Returns the aggregated state for the UI:
 * trades, config, statistics, candidates
 */
function getState(): AppState {
  return catchError<AppState>(() => {
    const plugin: TraderPlugin = global.TradingHelperLibrary;
    return {
      config: getConfig(),
      firebaseURL: FirebaseStore.url,
      info: new Statistics(DefaultStore).getAll(),
      candidates: plugin.getCandidates(new ChannelsDao(DefaultStore)),
      assets: new TradesDao(DefaultStore)
        .getList()
        .filter((a) => a.currentValue > 0 || a.tradeResult.soldPrice > 0),
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
    return `Done. Results were sent to your email.`;
  });
}

function addWithdrawal(amount: number): string {
  return catchError(() => {
    if (!isFinite(+amount)) throw new Error(`Amount is not a number.`);

    const configDao = new ConfigDao(DefaultStore);
    const mgr = new WithdrawalsManager(
      configDao,
      new Exchange(configDao),
      new Statistics(DefaultStore)
    );
    const { balance } = mgr.addWithdrawal(amount);
    const msg = `💳 Withdrawal of $${amount} was added to the statistics and the balance was updated. Current balance: $${balance}.`;
    Log.alert(msg);
    return msg;
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
global.addWithdrawal = addWithdrawal;
global.getState = getState;
global.buy = buy;
global.sell = sell;
global.keepCacheAlive = () => {
  catchError(() => {
    DefaultStore.keepCacheAlive();
  });
};
global.upgrade = () => {
  return catchError(() => {
    const result = Updater.upgrade();
    result.includes(UpgradeDone) && startAllProcesses();
    return result;
  });
};
