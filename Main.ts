const USDT = "USDT";

function doGet(e) {
  const store = new DefaultStore(PropertiesService.getScriptProperties());
  const binance = new Binance(store);
  return ContentService.createTextOutput(`handled doGet: ${binance.getFreeAsset(USDT)}`);
}

enum TradeAction {
  BUY = "BUY",
  SELL = "SELL"
}

enum TraderVersion {
  V1 = "v1",
  V2 = "v2"
}

type EventData = {
  ver: TraderVersion
  act: TradeAction
  sym: string
}

function doPost(e) {
  let store: IStore

  try {
    Log.debug(e.postData.contents)

    const eventData: EventData = JSON.parse(e.postData.contents)

    store = new DefaultStore(PropertiesService.getScriptProperties())
    const priceAsset = store.getOrSet("PriceAsset", USDT);
    const buyQuantity = +store.getOrSet("BuyQuantity", "50")
    const symbol = new ExchangeSymbol(eventData.sym, priceAsset)

    const actions = new Map()
    actions.set(`${TraderVersion.V1}/${TradeAction.BUY}`, () => new V1Trader(store, new Binance(store)).buy(symbol, buyQuantity))
    actions.set(`${TraderVersion.V1}/${TradeAction.SELL}`, () => new V1Trader(store, new Binance(store)).sell(symbol))
    actions.set(`${TraderVersion.V2}/${TradeAction.BUY}`, () => new V2Trader(store, new Binance(store)).buy(symbol, buyQuantity))
    actions.set(`${TraderVersion.V2}/${TradeAction.SELL}`, () => new V2Trader(store, new Binance(store)).sell(symbol))

    const action = `${eventData.ver}/${eventData.act}`;
    if (actions.has(action)) {
      Log.info(actions.get(action)().toString())
    } else {
      Log.info(`Unsupported action: ${action}`)
    }
  } catch (e) {
    Log.error(e)
  }

  Log.ifUsefulDumpAsEmail()
  return ContentService.createTextOutput("handled doPost");
}

function quickBuy() {
  const coin = ""
  const eventData: EventData = {
    act: TradeAction.BUY,
    sym: coin,
    ver: TraderVersion.V2
  }
  doPost({postData: {contents: JSON.stringify(eventData)}})
}
