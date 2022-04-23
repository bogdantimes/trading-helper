import {DefaultStore} from "./Store";
import {TradesQueue} from "./TradesQueue";
import {Statistics} from "./Statistics";

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
  return catchError(() => DefaultStore.getConfig());
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
