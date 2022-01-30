const USDT = "USDT";

function doGet(e) {
  const store = new DefaultStore(PropertiesService.getScriptProperties());
  return new V2TradeVisualizer(store).render();
}

enum TradeAction {
  BUY = "BUY",
  SELL = "SELL"
}

enum TraderVersion {
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
    const statistics = new Statistics(store);
    const priceAsset = store.getOrSet("PriceAsset", USDT);
    const buyQuantity = +store.getOrSet("BuyQuantity", "50")
    const symbol = new ExchangeSymbol(eventData.sym, priceAsset)

    const actions = new Map()
    actions.set(`${TraderVersion.V2}/${TradeAction.BUY}`, () => new V2Trader(store, new Binance(store)).buy(symbol, buyQuantity))
    actions.set(`${TraderVersion.V2}/${TradeAction.SELL}`, () => new V2Trader(store, new Binance(store)).sell(symbol))

    const action = `${eventData.ver}/${eventData.act}`;
    if (actions.has(action)) {
      const result = actions.get(action)();
      statistics.addProfit(result.profit)
      Log.info(result.toString())
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
