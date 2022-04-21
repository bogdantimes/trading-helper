import {V2Trader} from "./Trader";
import {BinanceStats} from "./BinanceStats";
import {Statistics} from "./Statistics";
import {DefaultStore} from "./Store";
import {TradesQueue} from "./TradesQueue";

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
  TradesQueue.flush();

  const store = DefaultStore;
  const trader = new V2Trader(store, new BinanceStats(store.getConfig()), new Statistics(store));

  store.getTradesList().forEach(tradeMemo => {
    try {
      tradeMemo.initState();
      trader.tickerCheck(tradeMemo);
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
