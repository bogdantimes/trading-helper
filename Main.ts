const logger = {
  log: [],
  info(arg) {
    this.log.push(arg)
  },
  dump() {
    return JSON.stringify(this.log)
  }
}

function doGet(e) {
  return ContentService.createTextOutput(`handled doGet: ${getFreeAsset("USDT")}`);
}

function doPost(e) {
  logger.info(e)
  try {
    const eventData = JSON.parse(e.postData.contents)
    if (eventData.symbol && eventData.side) {
      if (eventData.side == "BUY") {
        marketBuy(eventData.symbol);
      } else if (eventData.side == "SELL") {
        marketSell(eventData.symbol);
      }
    }
  } catch (e) {
    logger.info(e)
  }
  GmailApp.sendEmail("bogdan.kovalev.job@gmail.com", "Bot debug", logger.dump());
  return ContentService.createTextOutput("handled doPost");
}

const API = "https://api.binance.com/api/v3";
const KEY = PropertiesService.getScriptProperties().getProperty('KEY')
const SECRET = PropertiesService.getScriptProperties().getProperty('SECRET')

function getOrders(symbol: string) {
  const resource = "allOrders";
  const query = `symbol=${symbol}`;
  const data = execute({
    context: null,
    interval: 500,
    attempts: 60,
    runnable: ctx => UrlFetchApp.fetch(`${API}/${resource}?${addSignature(query)}`, {headers: {'X-MBX-APIKEY': KEY}})
  });
  logger.info(data.getContentText())
  return data.getContentText()
}

function getFreeAsset(asset: string) {
  const resource = "account"
  const query = "";
  const data = execute({
    context: null,
    interval: 500,
    attempts: 60,
    runnable: ctx => UrlFetchApp.fetch(`${API}/${resource}?${addSignature(query)}`, {headers: {'X-MBX-APIKEY': KEY}})
  });
  try {
    const account = JSON.parse(data.getContentText());
    const assetVal = account.balances.find((balance) => balance.asset == asset);
    logger.info(assetVal)
    return assetVal ? assetVal.free : ""
  } catch (e) {
    logger.info(e)
  }
  return ""
}

function marketBuy(symbol: string) {
  const freeAsset = getFreeAsset("USDT")

  if (!freeAsset || (+freeAsset < 60)) {
    logger.info(`NOT ENOUGH TO BUY, EXITING: USDT=${freeAsset}`)
    return
  }

  const resource = "order"
  const query = `symbol=${symbol}&type=MARKET&side=BUY&quoteOrderQty=50`;
  const data = execute({
    context: null,
    interval: 500,
    attempts: 60,
    runnable: ctx => UrlFetchApp.fetch(`${API}/${resource}?${addSignature(query)}`, {headers: {'X-MBX-APIKEY': KEY}})
  });
  logger.info(data.getContentText())
  return data.getContentText()
}

function marketSell(symbol: string) {
  const freeAsset = getFreeAsset(symbol)
  if (!freeAsset || (+freeAsset < 1)) {
    logger.info(`NOT ENOUGH TO SELL, EXITING: ${symbol}=${freeAsset}`)
    return
  }

  const resource = "order"
  const query = `symbol=${symbol}&type=MARKET&side=SELL&quantity=${freeAsset}`;
  const data = execute({
    context: null,
    interval: 500,
    attempts: 60,
    runnable: ctx => UrlFetchApp.fetch(`${API}/${resource}?${addSignature(query)}`, {headers: {'X-MBX-APIKEY': KEY}})
  });
  logger.info(data.getContentText())
  return data.getContentText()
}

function getPrice(symbol: string) {
  const resource = "ticker/price"
  const query = `symbol=${symbol}`;
  const data = execute({
    context: null,
    interval: 500,
    attempts: 20,
    runnable: ctx => UrlFetchApp.fetch(`${API}/${resource}?${query}`, {headers: {'X-MBX-APIKEY': KEY}})
  });
  logger.info(data.getContentText())
  return data.getContentText()
}

function addSignature(data: string) {
  const timestamp = Number(new Date().getTime()).toFixed(0);
  const sigData = `${data}${data ? "&" : ""}timestamp=${timestamp}`
  const sig = Utilities.computeHmacSha256Signature(sigData, SECRET).map(e => {
    const v = (e < 0 ? e + 256 : e).toString(16);
    return v.length == 1 ? "0" + v : v;
  }).join("")

  return `${sigData}&signature=${sig}`
}
