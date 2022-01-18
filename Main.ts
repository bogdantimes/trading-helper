function doGet(e) {
  return ContentService.createTextOutput(`handled doGet: ${getOrders("ETHUSDT")}`);
}

function doPost(e) {
  return ContentService.createTextOutput('handled doPost');
}

const API = "https://api.binance.com/api/v3";
const KEY = PropertiesService.getScriptProperties().getProperty('KEY')
const SECRET = PropertiesService.getScriptProperties().getProperty('SECRET')

function getOrders(symbol: string) {
  const requestManager = new RequestManager(API);
  requestManager.setRequestAttempts(2)

  const timestamp = Number(new Date().getTime()).toFixed(0);
  const params = `timestamp=${timestamp}`;
  const signature = Utilities.computeHmacSha256Signature(params, SECRET).map(e => {
    const v = (e < 0 ? e + 256 : e).toString(16);
    return v.length == 1 ? "0" + v : v;
  }).join("");

  const options = requestManager.addHeader({muteHttpExceptions: true}, 'X-MBX-APIKEY', KEY)
  const allOrders = requestManager.get("/openOrders", options, {timestamp, signature});

  Logger.log(allOrders)

  return allOrders
}
