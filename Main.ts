const USDT = "USDT";

function doGet(e) {
  const store = new DefaultStore(PropertiesService.getScriptProperties());
  const binance = new Binance(store);
  return ContentService.createTextOutput(`handled doGet: ${binance.getFreeAsset(USDT)}`);
}

enum Action {
  BUY = "BUY",
  SELL = "SELL"
}

enum Version {
  V1 = "v1",
  V2 = "v2"
}

function doPost(e) {
  let store: IStore

  try {
    Log.debug(e.postData.contents)

    const eventData: { ver: Version, sym: string, act: Action } = JSON.parse(e.postData.contents)

    store = new DefaultStore(PropertiesService.getScriptProperties())
    const priceAsset = store.getOrSet("PriceAsset", USDT);
    const buyQuantity = +store.getOrSet("BuyQuantity", "50")
    const symbol = new ExchangeSymbol(eventData.sym, priceAsset)

    const actions = new Map()
    actions.set(`${Version.V1}/${Action.BUY}`, () => new V1Trader(store, new Binance(store)).buy(symbol, buyQuantity))
    actions.set(`${Version.V1}/${Action.SELL}`, () => new V1Trader(store, new Binance(store)).sell(symbol))
    actions.set(`${Version.V2}/${Action.BUY}`, () => new V2Trader(store, new Binance(store)).buy(symbol, buyQuantity))
    actions.set(`${Version.V2}/${Action.SELL}`, () => new V2Trader(store, new Binance(store)).sell(symbol))

    const action = `${eventData.ver}/${eventData.act}`;
    if (actions.has(action)) {
      Log.info(actions.get(action)(eventData.sym).toString())
    } else {
      Log.info(`Unsupported action: ${action}`)
    }
  } catch (e) {
    Log.error(e)
  }

  store && store.dump()

  Log.ifUsefulDumpAsEmail()
  return ContentService.createTextOutput("handled doPost");
}
