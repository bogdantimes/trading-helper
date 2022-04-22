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
    return "Requested to buy " + coinName + "received";
  }
  return "No coinName specified";
}

function sellCoin(coinName: string) {
  if (coinName) {
    Log.info("Lazy selling called for " + coinName);
    TradesQueue.sell(coinName);
    return "Requested to sell " + coinName + "received";
  }
  return "No coinName specified";
}

function flipHold(coinName: string) {
  if (coinName) {
    Log.info("Flip hold called for " + coinName);
    TradesQueue.flipHold(coinName);
    return "Requested to flip hold for " + coinName + "received";
  }
  return "No coinName specified";
}

function getTrades() {
  // return trades that are not sold
  const trades = DefaultStore.getTrades();
  return Object.keys(trades).reduce((acc, key) => {
    if (!trades[key].stateIs(TradeState.SOLD)) {
      acc[key] = trades[key];
    }
    return acc;
  }, {});
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
