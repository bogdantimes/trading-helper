import {V2Trader} from "./Trader";
import {Exchange} from "./Exchange";
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
  const store = DefaultStore;
  // Sync cache as a first step in the background ticker process is needed to ensure we operate with
  // the latest data from the DB (in case DB was updated externally).
  // This is the only place where we can call syncCache().
  store.syncCache();

  TradesQueue.flush();

  const trader = new V2Trader(store, new Exchange(store.getConfig()), new Statistics(store));

  store.getTradesList().forEach(tradeMemo => {
    try {
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
