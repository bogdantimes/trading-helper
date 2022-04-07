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

  BuyingQueue.getAll().forEach(coinName => {
    try {
      Log.info(`Trying to buy from queue: ${coinName}`)
      trader.buy(new ExchangeSymbol(coinName, config.PriceAsset), config.BuyQuantity)
      BuyingQueue.remove(coinName)
    } catch (e) {
      Log.error(e)
    }
  });

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
