import {Config, DefaultStore} from "./Store";
import {TradesQueue} from "./TradesQueue";
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

function catchError(fn: () => any): any {
  try {
    return fn();
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
    if (coinName) {
      Log.info("Lazy buying called for " + coinName);
      TradesQueue.buy(coinName);
      return "Requested to buy " + coinName;
    }
    return "No coinName specified";
  });
}

function cancelAction(coinName: string): string {
  return catchError(() => {
    if (coinName) {
      Log.info("Cancelling the action on " + coinName);
      TradesQueue.cancelAction(coinName);
      return "Requested to cancel an action on " + coinName;
    }
    return "No coinName specified";
  });
}

function sellCoin(coinName: string): string {
  return catchError(() => {
    if (coinName) {
      Log.info("Lazy selling called for " + coinName);
      TradesQueue.sell(coinName);
      return "Requested to sell " + coinName;
    }
    return "No coinName specified";
  });
}

function setHold(coinName: string, value: boolean): string {
  return catchError(() => {
    if (coinName) {
      Log.info("Flip hold called for " + coinName + " to " + value);
      TradesQueue.setHold(coinName, value);
      return "Requested to flip hold for " + coinName + " to " + value;
    }
    return "No coinName specified";
  });
}

function dropCoin(coinName: string): string {
  return catchError(() => {
    if (coinName) {
      Log.info("Drop called for " + coinName);
      TradesQueue.dropCoin(coinName);
      return "Requested to drop " + coinName;
    }
    return "No coinName specified";
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

function setConfig(config): void {
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
