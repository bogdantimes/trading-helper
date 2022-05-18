import {Config, DefaultStore} from "./Store";
import {TradeActions} from "./TradeActions";
import {Statistics, Stats} from "./Statistics";
import {Exchange} from "./Exchange";
import {Survivors} from "./Survivors";
import {CoinScore} from "./shared-lib/types";
import {TradeMemo} from "./TradeMemo";

function doGet() {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function doPost(e) {
  return "404";
}

function catchError<T>(fn: () => T): T {
  try {
    const res = fn();
    Log.ifUsefulDumpAsEmail();
    return res;
  } catch (e) {
    Log.error(e);
    Log.ifUsefulDumpAsEmail();
    throw e;
  }
}

function initialSetup(params: InitialSetupParams): string {
  return catchError(() => {
    if (params.dbURL) {
      Log.alert("Initial setup");
      Log.alert("Connecting to Firebase with URL: " + params.dbURL);
      DefaultStore.connect(params.dbURL);
      Log.alert("Connected to Firebase");
    }
    const config = DefaultStore.getConfig();
    config.KEY = params.binanceAPIKey || config.KEY;
    config.SECRET = params.binanceSecretKey || config.SECRET;
    if (config.KEY && config.SECRET) {
      Log.alert("Checking if Binance is reachable");
      new Exchange(config).getFreeAsset(config.StableCoin);
      Log.alert("Connected to Binance");
      // @ts-ignore
      Start();
    }
    DefaultStore.setConfig(config);
    return "OK";
  });
}

export type InitialSetupParams = {
  dbURL: string,
  binanceAPIKey: string,
  binanceSecretKey: string
}

function buyCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.buy(coinName);
    return "Requested to buy " + coinName;
  });
}

function cancelAction(coinName: string): string {
  return catchError(() => {
    TradeActions.cancel(coinName);
    return "Requested to cancel an action on " + coinName;
  })
}

function sellCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.sell(coinName);
    return "Requested to sell " + coinName;
  });
}

function setHold(coinName: string, value: boolean): string {
  return catchError(() => {
    TradeActions.setHold(coinName, value);
    return "Requested to set hold for " + coinName + " to " + value;
  });
}

function dropCoin(coinName: string): string {
  return catchError(() => {
    TradeActions.drop(coinName);
    return "Requested to drop " + coinName;
  });
}

function editTrade(coinName: string, newTradeMemo: TradeMemo): string {
  return catchError(() => {
    TradeActions.replace(coinName, TradeMemo.copy(newTradeMemo));
    return "Requested to edit trade for " + coinName;
  });
}

function getTrades(): { [p: string]: TradeMemo } {
  return catchError(() => DefaultStore.getTrades());
}

function getConfig(): Config {
  return catchError(() => {
    return DefaultStore.isConnected() ? DefaultStore.getConfig() : null;
  });
}

function setConfig(config): string {
  return catchError(() => {
    DefaultStore.setConfig(config);
    return "Config updated";
  });
}

function getStatistics(): Stats {
  return catchError(() => new Statistics(DefaultStore).getAll());
}

function getSurvivors(): CoinScore[] {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig());
    return new Survivors(DefaultStore, exchange).getScores();
  });
}

function resetSurvivors(): void {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig());
    return new Survivors(DefaultStore, exchange).resetScores();
  });
}

function getCoinNames(): string[] {
  return catchError(() => {
    const exchange = new Exchange(DefaultStore.getConfig());
    return exchange.getCoinNames();
  })
}
