import {DefaultStore} from "./Store";
import {GasEventHandler} from "./Main";
import {BuyingQueue} from "./BuyingQueue";

function doGet() {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  return GasEventHandler.handle(e)
}

function lazyBuy(coinName: string) {
  if (coinName) {
    Log.alert("Lazy buying called for " + coinName);
    const config = DefaultStore.getConfig();
    BuyingQueue.add(new ExchangeSymbol(coinName, config.PriceAsset), config.BuyQuantity);
    return `Added ${coinName} to the buying queue`;
  }
  return "No coinName specified";
}

function quickBuy(asset: string) {
  if (asset) {
    Log.info(`quickBuy called for ${asset}`)
    return GasEventHandler.handle({postData: {contents: `buy ${asset}`}})
  }
}

function quickSell(asset: string) {
  if (asset) {
    Log.info(`quickSell called for ${asset}`)
    return GasEventHandler.handle({postData: {contents: `sell ${asset}`}})
  }
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
