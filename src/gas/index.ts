import {
  AWS_LIMIT,
  CachedStore,
  DefaultStore,
  FirebaseStore,
  LIMIT_ERROR,
} from "./Store";
import { Statistics } from "./Statistics";
import { Log, SECONDS_IN_MIN, TICK_INTERVAL_MIN } from "./Common";
import {
  type AppState,
  BullRun,
  type CandidateInfo,
  type CandidatesData,
  type CoinName,
  type Config,
  f0,
  f2,
  type InitialSetupParams,
  type IStore,
  Key,
  MASK,
  MIN_BUY,
  prettyPrintTradeMemo,
  StableUSDCoin,
  StoreDeleteProp,
  TradeState,
} from "../lib";
import { Process } from "./Process";
import { CacheProxy } from "./CacheProxy";
import { TradesDao } from "./dao/Trades";
import { ConfigDao } from "./dao/Config";
import { TradeManager } from "./TradeManager";
import { Updater, UpgradeDone } from "./Updater";
import { type TraderPlugin } from "./traders/plugin/api";
import { WithdrawalsManager } from "./WithdrawalsManager";
import { CandidatesDao } from "./dao/Candidates";
import { Binance } from "./Binance";
import { MarketDataDao } from "./dao/MarketData";
import { MarketInfoProvider } from "./providers/MarketInfoProvider";
import { PriceProvider } from "./providers/PriceProvider";
import HtmlOutput = GoogleAppsScript.HTML.HtmlOutput;

function doGet(): HtmlOutput {
  return catchError(() => {
    return (
      HtmlService.createTemplateFromFile(`index`)
        .evaluate()
        .setFaviconUrl(
          `https://user-images.githubusercontent.com/7527778/167810306-0b882d1b-64b0-4fab-b647-9c3ef01e46b4.png`,
        )
        .addMetaTag(
          `viewport`,
          `width=device-width, initial-scale=1, maximum-scale=1`,
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
    `ℹ️ Background processes started. State synchronization interval is ${TICK_INTERVAL_MIN} minute.`,
  );
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
    if (e.message.includes(AWS_LIMIT)) {
      // try again after small delay
      Utilities.sleep(500 + new Date().getMilliseconds());
      return catchError(fn);
    }
    if (e.message.match(LIMIT_ERROR)) {
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
    const config = new ConfigDao(store).update((config) => {
      config.KEY = params.binanceAPIKey ?? config.KEY;
      config.SECRET = params.binanceSecretKey ?? config.SECRET;
      config.ViewOnly = params.viewOnly;
      return config;
    });
    if (config.ViewOnly || (config.KEY && config.SECRET)) {
      startAllProcesses();
    }
    Log.alert(`✨ Initial setup done.`);
    return `OK`;
  });
}

function sellAll(): string {
  return catchError(() => {
    TradeManager.default().sellAll();
    return Log.printInfos();
  });
}

function remove(...coins: CoinName[]): string {
  return catchError(() => {
    const dao = new TradesDao(DefaultStore);
    coins?.forEach((c) => {
      dao.update(c, (trade) => {
        trade.deleted = true;
        return trade;
      });
    });
    return `Removed ${coins?.join(`, `)}`;
  });
}

function setConfig(newCfg: Config): { msg: string; config: Config } {
  return catchError(() => {
    let msg = `Config updated.`;
    const dao = new ConfigDao(DefaultStore);
    let dryRunToggledOff = false;
    dao.update((curCfg) => {
      if (
        !newCfg.DryRun &&
        curCfg.StableBalance <= 0 &&
        newCfg.StableBalance > 0
      ) {
        // If not dry run, check the balance is actually present on Spot balance
        const balance = new Binance(dao).getBalance(newCfg.StableCoin);
        if (balance < newCfg.StableBalance) {
          msg = `\nActual balance on your Binance Spot account is $${f2(
            balance,
          )}, which is less than $${
            newCfg.StableBalance
          } you are trying to set. You might need to transfer money from the Funding account. Check the balances and try again.`;
          newCfg.StableBalance = curCfg.StableBalance;
        }
      }
      if (curCfg.DryRun && !newCfg.DryRun) {
        dryRunToggledOff = true;
        msg += `\n"Dry Run" mode is disabled. Any dry run assets are being removed from the portfolio. Balance was reset to 0.`;
        newCfg.StableBalance = 0;
      }
      return newCfg;
    });
    if (dryRunToggledOff) {
      new TradesDao(DefaultStore).iterate((tm) => {
        if (tm.tradeResult.dryRun) {
          tm.deleted = true;
          return tm;
        }
      });
    }
    return { msg, config: newCfg };
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
  config.KEY = config.KEY ? MASK : ``;
  config.SECRET = config.SECRET ? MASK : ``;
  return config;
}

const plugin: TraderPlugin = global.TradingHelperLibrary;

function getCandidates(): CandidatesData {
  const candidatesDao = new CandidatesDao(DefaultStore);
  const mktInfoProvider = new MarketInfoProvider(
    new MarketDataDao(DefaultStore),
    candidatesDao,
    plugin,
  );
  const { all, selected } = plugin.getCandidates(candidatesDao);
  // Add pinned candidates
  const other = {};
  Object.keys(all).forEach((coin) => {
    const ci = all[coin];
    if (ci[Key.PINNED] || (ci[Key.IMBALANCE] && ci[Key.IMBALANCE] > 0.3)) {
      other[coin] = ci;
    }
  });
  return {
    selected,
    other,
    marketInfo: mktInfoProvider.get(-1),
  };
}

/**
 * Returns the aggregated state for the UI:
 * trades, config, statistics, candidates
 */
function getState(): AppState {
  return {
    config: getConfig(),
    firebaseURL: FirebaseStore.url,
    info: new Statistics(DefaultStore).getAll(),
    candidates: getCandidates(),
    assets: new TradesDao(DefaultStore).getList(),
  };
}

function buy(coin: CoinName, cost: number): string {
  return catchError(() => {
    if (!coin) {
      Log.info(`Specify a coin name, e.g. BTC`);
      return Log.printInfos();
    }

    if (!isFinite(+cost) || +cost < MIN_BUY) {
      Log.info(
        `Specify the amount (available on the balance) you're willing to invest, e.g. 150`,
      );
      return Log.printInfos();
    }

    TradeManager.default().buy(coin.toUpperCase(), cost);
    return Log.printInfos() || `In progress!`;
  });
}

function sell(coin: CoinName, chunkSize = 1): string {
  return catchError(() => {
    if (isFinite(+chunkSize)) {
      TradeManager.default().sell(coin, +chunkSize);
    } else {
      Log.info(
        `The provided chunk size is not a valid number. Expected range: 0 < chunk <= 1. Default: 1`,
      );
    }
    return Log.printInfos();
  });
}

function edit(coin: CoinName, qty: number, paid: number): any {
  return catchError(() => {
    qty = +qty;
    paid = +paid;
    if (!coin) {
      Log.info(`Specify a coin name, e.g. BTC`);
    } else if (!isFinite(qty)) {
      Log.info(`Specify a proper amount of coins, e.g. 1.251`);
    } else if (!isFinite(paid)) {
      Log.info(`Specify how much you paid for the coin (in USD)`);
    } else {
      TradeManager.default().edit(coin, qty, paid);
    }
    return Log.printInfos();
  });
}

function swap(src: CoinName, tgt: CoinName, chunkSize = 1): string {
  if (!src) {
    Log.info(`Specify a source asset, e.g. BTC`);
  } else if (!tgt) {
    Log.info(`Specify a target coin, e.g. ETH`);
  }

  if (isFinite(+chunkSize)) {
    TradeManager.default().swap(src, tgt, +chunkSize);
  } else {
    Log.info(
      `The provided chunk size is not a valid number. Expected range: 0 < chunk <= 1. Default: 1`,
    );
  }
  return Log.printInfos();
}

function swapAll(tgt: CoinName, chunkSize = 1): string {
  return catchError(() => {
    new TradesDao(DefaultStore).getList(TradeState.BOUGHT).forEach((tm) => {
      try {
        swap(tm.getCoinName(), tgt, chunkSize);
      } catch (e) {
        e.message = `Error when swapping ${tm.getCoinName()} to ${tgt}: ${e.message}`;
        Log.error(e);
        return ``;
      }
    });
    return Log.printInfos();
  });
}

function importCoin(coin: CoinName, qty?: number): any {
  return catchError(() => {
    if (!coin) {
      Log.info(`Specify a coin name, e.g. BTC`);
    } else if (qty && !isFinite(qty)) {
      Log.info(`Specify a proper amount of coins, e.g. 1.251`);
    } else {
      TradeManager.default().import(coin, qty ? +qty : 0);
    }
    return Log.printInfos();
  });
}

function addWithdrawal(amount: number): string {
  return catchError(() => {
    if (!isFinite(+amount)) throw new Error(`Amount is not a number.`);

    const configDao = new ConfigDao(DefaultStore);
    const mgr = new WithdrawalsManager(configDao, new Statistics(DefaultStore));
    const { balance } = mgr.addWithdrawal(+amount);
    const msg = `Withdrawal of $${+amount} was added to the statistics and the balance was updated. Current balance: $${balance}.`;
    Log.alert(msg);
    return Log.printInfos();
  });
}

global.doGet = doGet;
global.doPost = doPost;
global.tick = tick;
global.start = start;
global.stop = stop;
global.initialSetup = initialSetup;
global.setConfig = setConfig;
global.setFirebaseURL = setFirebaseURL;
global.buy = buy;
global.sell = sell;
global.sellAll = sellAll;
global.remove = remove;
global.edit = edit;
global.swap = swap;
global.swapAll = swapAll;
global.importCoin = importCoin;
global.addWithdrawal = addWithdrawal;
global.getState = getState;
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
global.info = (coin: CoinName) => {
  coin = coin?.trim().toUpperCase();

  const candidatesDao = new CandidatesDao(DefaultStore);
  if (!coin) {
    const marketInfoProvider = new MarketInfoProvider(
      new MarketDataDao(DefaultStore),
      candidatesDao,
      plugin,
    );
    const info = marketInfoProvider.get(-1);

    Log.ifUsefulDumpAsEmail();

    return `Bull-Run: ${BullRun[info.bullRun]}
The current market is ${
      info.strength > 0.9
        ? `strong. It's good time to buy.`
        : info.strength < 0.1
          ? `weak. It's good time to sell.`
          : `unclear. Trade with caution.`
    }
Strength (0..100): ${f0(info.strength * 100)}
Average demand (-100..100): ${f0(info.averageDemand * 100)}%
Accuracy (0..100): ${f0(info.accuracy * 100)}%${
      info.accuracy < 0.5
        ? ` (automatically improved over time for TH+ subscribers)`
        : ``
    }`;
  }

  let result = ``;

  candidatesDao.update((all) => {
    const ci = all[coin];
    if (!ci) {
      result = `${coin} is not tracked as a candidate; either it does not exist or it lacks historical price data yet.`;
    }

    const imbalance = plugin.getImbalance(coin, ci);
    ci[Key.IMBALANCE] = imbalance;

    const curRange = `${f0(ci?.[Key.MIN_PERCENTILE] * 100)}-${f0(
      ci?.[Key.MAX_PERCENTILE] * 100,
    )}`;
    result = `== CANDIDATE ==\nStrength (0..100): ${f0(
      ci?.[Key.STRENGTH] * 100,
    )}
Demand (-100..100): ${f0(imbalance * 100)}%
Support: ${ci?.[Key.MIN]}
Resistance: ${ci?.[Key.MAX]}
Current price zone (-|0..100|+): ${curRange}%`;

    return all;
  });

  const tm = new TradesDao(DefaultStore).get(coin);
  if (tm?.stateIs(TradeState.BOUGHT)) {
    result += `\n\n== ASSET ==\n${prettyPrintTradeMemo(tm)}`;
  }
  return result;
};
global.getImbalance = (coin: CoinName, ci?: CandidateInfo) => {
  const candidatesDao = new CandidatesDao(DefaultStore);
  const imbalance = plugin.getImbalance(coin, ci || candidatesDao.get(coin));

  if (ci && ci[Key.IMBALANCE] !== imbalance) {
    candidatesDao.update((all) => {
      all[coin][Key.IMBALANCE] = imbalance;
      return all;
    });
  }

  if (!ci) {
    const tradesDao = new TradesDao(DefaultStore);
    if (tradesDao.has(coin)) {
      tradesDao.update(coin, (tm) => {
        tm.supplyDemandImbalance = imbalance;
        return tm;
      });
    }
  }

  return imbalance;
};
global.pin = (coin: CoinName, value = true) => {
  coin = coin.toUpperCase();
  new CandidatesDao(DefaultStore).pin(coin, value);
  return Log.printInfos();
};

const helpDescriptions = {
  start: `Starts all background processes.`,
  stop: `Stops the trading process.`,
  info: `Returns information about the market or a coin. Examples: 1) $ info 2) $ info BTC`,
  topc: `Shows candidates that are breaking out and/or showing strength right now.`,
  pin: `Pins a candidate. Example: $ pin BTC`,
  buy: `Buys a coin. Format: $ buy [COIN] [amount (USDT)]. Example: $ buy BTC 150`,
  sell: `Sells a whole or a chunk of the asset. Example (whole): $ sell BTC. Example (half): $ sell BTC 0.5`,
  sellAll: `Sells all coins.`,
  remove: `Removes a list of coins from the trade list. Example: $ remove BTC ETH`,
  edit: `Creates or edits a coin in the portfolio. Format: $ edit [COIN] [amount] [paid (in USD)]. Example: $ edit BTC 0.5 15500`,
  swap: `Swaps an existing asset into another one. Example (whole): $ swap INJ BTC. Example (half): $ swap INJ BTC 0.5`,
  importCoin: `Imports a coin from the Binance Spot portfolio. Imports all or the specified amount. Example: $ importCoin BTC [amount]`,
  addWithdrawal: `Adds a withdrawal to the statistics. Example: $ addWithdrawal 100`,
  upgrade: `Upgrades the system.`,
};

global.help = (): string => {
  return Object.entries(helpDescriptions)
    .map(([funcName, description]) => `${funcName}: ${description}`)
    .join(`\n\n`);
};

global.topc = (): string => {
  const allCands = new CandidatesDao(DefaultStore).getAll();
  const sortedCands = Object.entries(allCands).sort(
    ([, a], [, b]) => b[Key.PERCENTILE] - a[Key.PERCENTILE],
  );
  const prices = new PriceProvider(plugin, CacheProxy).get(StableUSDCoin.USDT);
  for (const [coin, ci] of sortedCands) {
    const minPrice = Math.min(...prices[coin].prices);
    const currentPrice = prices[coin].currentPrice;
    const pricePump = currentPrice > minPrice * 1.01;
    if (ci[Key.PERCENTILE] > 1 || pricePump) {
      Log.info(
        `${coin}: P=${ci[Key.PERCENTILE]} | I: ${ci[Key.IMBALANCE]} ${pricePump ? `| +++` : ``}`,
      );
    }
  }
  return Log.printInfos() || `No breaking out coins as of now. Try later.`;
};

global.resetCandidates = () => {
  new CandidatesDao(DefaultStore).update(() => StoreDeleteProp);
  return `Done.`;
};
