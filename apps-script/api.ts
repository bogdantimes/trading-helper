import {DefaultStore} from "./Store";
import {TradesQueue} from "./TradesQueue";
import {Statistics} from "./Statistics";
import {Binance} from "./Binance";

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

function initialSetup(params: InitialSetupParams) {
  return catchError(() => {
    Log.info("Initial setup");
    Log.info("Connecting to Firebase with URL: " + params.dbURL);
    DefaultStore.connect(params.dbURL);
    Log.info("Connected to Firebase");
    const config = DefaultStore.getConfig();
    config.KEY = params.binanceAPIKey ? params.binanceAPIKey : config.KEY;
    config.SECRET = params.binanceSecretKey ? params.binanceSecretKey : config.SECRET;
    Log.info("Checking if Binance is reachable");
    new Binance(config).getFreeAsset(config.PriceAsset);
    DefaultStore.setConfig(config);
    Log.info("Configured Binance API key and secret key");
    return "OK";
  });
}

export type InitialSetupParams = {
  dbURL: string,
  binanceAPIKey: string,
  binanceSecretKey: string
}

function buyCoin(coinName: string) {
  return catchError(() => {
    if (coinName) {
      Log.info("Lazy buying called for " + coinName);
      TradesQueue.buy(coinName);
      return "Requested to buy " + coinName;
    }
    return "No coinName specified";
  });
}

function sellCoin(coinName: string) {
  return catchError(() => {
    if (coinName) {
      Log.info("Lazy selling called for " + coinName);
      TradesQueue.sell(coinName);
      return "Requested to sell " + coinName;
    }
    return "No coinName specified";
  });
}

function setHold(coinName: string, value: boolean) {
  return catchError(() => {
    if (coinName) {
      Log.info("Flip hold called for " + coinName + " to " + value);
      TradesQueue.setHold(coinName, value);
      return "Requested to flip hold for " + coinName + " to " + value;
    }
    return "No coinName specified";
  });
}

function dropCoin(coinName: string) {
  return catchError(() => {
    if (coinName) {
      Log.info("Drop called for " + coinName);
      TradesQueue.dropCoin(coinName);
      return "Requested to drop " + coinName;
    }
    return "No coinName specified";
  });
}

function getTrades() {
  return catchError(() => DefaultStore.getTrades());
}

function getConfig() {
  return catchError(() => {
    return DefaultStore.isConnected() ? DefaultStore.getConfig() : null;
  });
}

function setConfig(config) {
  return catchError(() => {
    DefaultStore.setConfig(config);
    return "Config updated";
  });
}

function getStatistics() {
  return catchError(() => new Statistics(DefaultStore).getAll());
}
