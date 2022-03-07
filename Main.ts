const USDT = "USDT";

function doGet(e) {
  return new V2TradeVisualizer(DefaultStore).render();
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

    store = DefaultStore
    const statistics = new Statistics(store);
    const priceAsset = store.getOrSet("PriceAsset", USDT);
    const buyQuantity = +store.getOrSet("BuyQuantity", "50")
    const symbol = new ExchangeSymbol(tradeReq.sym, priceAsset.toString())

    const trader = new V2Trader(store, new Binance(store), statistics);
    if (tradeReq.act == TradeAction.BUY) {
      Log.info(trader.buy(symbol, buyQuantity).toString())
    } else if (tradeReq.act == TradeAction.SELL) {
      Log.info(trader.sell(symbol).toString())
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
  const asset = DefaultStore.get(RetryBuying);
  if (asset) {
    Log.info(`quickBuy called for ${asset}`)
    doPost({postData: {contents: `buy ${asset}`}})
  }
}

function quickSell(asset: string) {
  if (asset) {
    Log.info(`quickSell called for ${asset}`)
    doPost({postData: {contents: `sell ${asset}`}})
  }
}
