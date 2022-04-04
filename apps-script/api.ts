import {DefaultStore} from "./Store";
import {GasEventHandler} from "./Main";

function doGet() {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost(e) {
  return GasEventHandler.handle(e)
}

function quickBuy(asset: string) {
  if (asset) {
    Log.info(`quickBuy called for ${asset}`)
    GasEventHandler.handle({postData: {contents: `buy ${asset}`}})
  }
}

function quickSell(asset: string) {
  if (asset) {
    Log.info(`quickSell called for ${asset}`)
    GasEventHandler.handle({postData: {contents: `sell ${asset}`}})
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
