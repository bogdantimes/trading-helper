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

type TradeRequest = {
  ver: TraderVersion
  act: TradeAction
  sym: string
}

/**
 * Expected format:
 * "buy BTCUSDT"
 * "sell ETHUSDT"
 * @param req
 */
function parseTradeRequest(req: string): TradeRequest {
  const tokens = req.toUpperCase().trim().split(/\s/)
  if (tokens.length == 2) {
    const data: TradeRequest = {
      act: TradeAction[tokens[0]],
      sym: tokens[1].split(USDT)[0],
      ver: TraderVersion.V2
    }
    if (data.act && data.sym && data.ver) {
      return data
    }
  }
  throw Error(`invalid request: ${req}`)
}

function doPost(e) {
  let store: IStore

  try {
    Log.debug(e.postData.contents)

    const tradeReq: TradeRequest = parseTradeRequest(e.postData.contents)

    store = new DefaultStore(PropertiesService.getScriptProperties())
    const statistics = new Statistics(store);
    const priceAsset = store.getOrSet("PriceAsset", USDT);
    const buyQuantity = +store.getOrSet("BuyQuantity", "50")
    const symbol = new ExchangeSymbol(tradeReq.sym, priceAsset.toString())

    const trader = new V2Trader(store, new Binance(store), statistics);
    if (tradeReq.act == TradeAction.BUY) {
      Log.info(trader.buy(symbol, buyQuantity))
    } else if (tradeReq.act == TradeAction.SELL) {
      Log.info(trader.sell(symbol))
    } else {
      Log.info(`Unsupported action: ${tradeReq.act}`)
    }
  } catch (e) {
    Log.error(e)
  }

  Log.ifUsefulDumpAsEmail()
  return ContentService.createTextOutput("handled doPost");
}

const RetryBuying = "retryBuying";

function quickBuy() {
  const store = new DefaultStore(PropertiesService.getScriptProperties())
  const asset = store.get(RetryBuying);
  if (asset) {
    Log.info(`quickBuy called for ${asset}`)
    doPost({postData: {contents: `buy ${asset}`}})
  }
}
