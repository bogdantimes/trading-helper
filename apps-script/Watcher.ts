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
  const trader = new V2Trader(store, new BinanceStats(store.getConfig()), statistics);
  let sendLog = true;

  Object.values(store.getTrades())
    .forEach((tradeRaw: object) => {
      const tradeMemo: TradeMemo = TradeMemo.fromObject(tradeRaw);
      try {
        const result = trader.tickerCheck(tradeMemo);
        Log.info(result.toString())
        sendLog = result.fromExchange
      } catch (e) {
        Log.error(e)
      }
    })

  if (config.BuyingQueueEnabled) {
    BuyingQueue.getAll().forEach(item => {
      try {
        Log.info(`Trying to buy from queue: ${item.quantityAsset}`)
        const symbol = ExchangeSymbol.fromObject(item);
        trader.buy(symbol, item.cost)
        BuyingQueue.remove(symbol)
      } catch (e) {
        Log.error(e)
      }
    });
  }

  store.dumpChanges();

  if (sendLog) {
    Log.ifUsefulDumpAsEmail()
  }
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
