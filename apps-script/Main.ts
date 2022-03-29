const USDT = "USDT";

function doGet() {
  return HtmlService
    .createTemplateFromFile('index')
    .evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

enum TradeAction {
  BUY = "BUY",
  SELL = "SELL"
}
type TradeRequest = {
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
      sym: tokens[1].split(USDT)[0]
    }
    if (data.act && data.sym) {
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
  return ContentService.createTextOutput(Log.print());
}

function quickBuy(asset: string) {
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
