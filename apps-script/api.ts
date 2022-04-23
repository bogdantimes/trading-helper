import {DefaultStore} from "./Store";
import {TradesQueue} from "./TradesQueue";
import {Statistics} from "./Statistics";
import {TradeState} from "./TradeMemo";

function doGet() {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function doPost(e) {
  return "404";
}

function buyCoin(coinName: string) {
  if (coinName) {
    Log.info("Lazy buying called for " + coinName);
    TradesQueue.buy(coinName);
    return "Requested to buy " + coinName;
  }
  return "No coinName specified";
}

function sellCoin(coinName: string) {
  if (coinName) {
    Log.info("Lazy selling called for " + coinName);
    TradesQueue.sell(coinName);
    return "Requested to sell " + coinName;
  }
  return "No coinName specified";
}

function setHold(coinName: string, value: boolean) {
  if (coinName) {
    Log.info("Flip hold called for " + coinName + " to " + value);
    TradesQueue.setHold(coinName, value);
    return "Requested to flip hold for " + coinName + " to " + value;
  }
  return "No coinName specified";
}

function dropCoin(coinName: string) {
  if (coinName) {
    Log.info("Drop called for " + coinName);
    TradesQueue.dropCoin(coinName);
    return "Requested to drop " + coinName;
  }
  return "No coinName specified";
}

function getTrades() {
  return DefaultStore.getTrades()
}

function getConfig() {
  return DefaultStore.getConfig()
}

function setConfig(config) {
  DefaultStore.setConfig(config)
}

function getStatistics() {
  return new Statistics(DefaultStore).getAll()
}
