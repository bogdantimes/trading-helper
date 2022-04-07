import {V2Trader} from "./Trader";
import {BinanceStats} from "./BinanceStats";
import {DefaultStore, IStore} from "./Store";
import {Statistics} from "./Statistics";
import TextOutput = GoogleAppsScript.Content.TextOutput;

enum TradeAction {
  BUY = "BUY",
  SELL = "SELL"
}

type TradeRequest = {
  act: TradeAction
  sym: string
}

export class GasEventHandler {
  static handle(e): TextOutput {
    let store: IStore

    try {
      Log.debug(e.postData.contents)

      const tradeReq: TradeRequest = this.parseTradeRequest(e.postData.contents)

      store = DefaultStore
      const config = store.getConfig();
      const statistics = new Statistics(store);
      const priceAsset = config.PriceAsset;
      const buyQuantity = config.BuyQuantity;
      const symbol = new ExchangeSymbol(tradeReq.sym, priceAsset.toString())

      const trader = new V2Trader(store, new BinanceStats(config), statistics);
      if (tradeReq.act == TradeAction.BUY) {
        Log.info(trader.buy(symbol, buyQuantity).toString())
      } else if (tradeReq.act == TradeAction.SELL) {
        Log.info(trader.sell(symbol).toString())
      } else {
        Log.info(`Unsupported action: ${tradeReq.act}`)
      }
    } catch (e) {
      Log.error(e)
    } finally {
      if (store) {
        store.dumpChanges()
      }
    }

    Log.ifUsefulDumpAsEmail()
    return ContentService.createTextOutput(Log.print());
  }

  /**
   * Expected format:
   * "buy BTC"
   * "sell ETH"
   * @param req
   */
  static parseTradeRequest(req: string): TradeRequest {
    const tokens = req.toUpperCase().trim().split(/\s/)
    if (tokens.length == 2) {
      const data: TradeRequest = {
        act: TradeAction[tokens[0]],
        sym: tokens[1]
      }
      if (data.act && data.sym) {
        return data
      }
    }
    throw Error(`invalid request: ${req}`)
  }
}
