import {TradeMemo} from "./TradeMemo";
import {V2Trader} from "./Trader";
import {BinanceStats} from "./BinanceStats";
import {Statistics} from "./Statistics";
import {DefaultStore} from "./Store";
import {BuyingQueue} from "./BuyingQueue";

class Watcher {
  static start() {
    try {
      ScriptApp.newTrigger(Ticker.name).timeBased().everyMinutes(1).create()
      Log.info(`Started ${Ticker.name}`)
    } catch (e) {
      Log.error(e)
    }
  }

  static stop() {
    const trigger = ScriptApp.getProjectTriggers().find(t => t.getHandlerFunction() == Ticker.name);
    if (trigger) {
      try {
        ScriptApp.deleteTrigger(trigger);
        Log.info(`Stopped ${Ticker.name}`)
      } catch (e) {
        Log.error(e)
      }
    }
  }
}

function Ticker() {
  const store = DefaultStore;
  const config = store.getConfig();
  const statistics = new Statistics(store);
  const trader = new V2Trader(store, new BinanceStats(config), statistics);

  BuyingQueue.getAll().forEach(coinName => {
    try {
      Log.info(`Adding from queue to trades: ${coinName}`)
      const symbol = new ExchangeSymbol(coinName, config.PriceAsset);
      const trade = store.getTrade(symbol) || TradeMemo.memoToBuy(symbol);
      trade.buy = true;
      store.setTrade(trade);
      BuyingQueue.remove(coinName)
    } catch (e) {
      Log.error(e)
    }
  });

  store.getTradesList().forEach(tradeMemo => {
    try {
      const result = trader.tickerCheck(tradeMemo);
      Log.info(result.toString())
    } catch (e) {
      Log.error(e)
    }
  })

  store.dumpChanges();

  Log.ifUsefulDumpAsEmail()
}

function Start() {
  Stop()
  Watcher.start()
  Log.ifUsefulDumpAsEmail()
}

function Stop() {
  Watcher.stop()
  Log.ifUsefulDumpAsEmail()
}
