import {DefaultStore} from "./Store";
import {GasEventHandler} from "./Main";
import {BuyingQueue} from "./BuyingQueue";
import {Statistics} from "./Statistics";

function doGet() {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  return GasEventHandler.handle(e)
}

function buyCoin(coinName: string) {
  if (coinName) {
    Log.info("Lazy buying called for " + coinName);
    BuyingQueue.add(coinName);
    return "Buying " + coinName + " as soon as possible";
  }
  return "No coinName specified";
}

function sellCoin(coinName: string) {
  if (coinName) {
    Log.info("Lazy selling called for " + coinName);
    DefaultStore.set(`trade/${coinName}/sell`, true);
    return "Selling " + coinName + " as soon as possible";
  }
  return "No coinName specified";
}

function getTrades() {
  // return trades that are not sold
  const trades = DefaultStore.getTrades();
  return Object.keys(trades).reduce((acc, key) => {
    if (!trades[key].sold) {
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
