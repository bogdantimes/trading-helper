import {V2Trader} from "./Trader";
import {Exchange} from "./Exchange";
import {Statistics} from "./Statistics";
import {DefaultStore} from "./Store";
import {TradesQueue} from "./TradesQueue";
import {Survivors} from "./Survivors";

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
  let exchange: Exchange;
  let trader: V2Trader;

  try {
    exchange = new Exchange(store.getConfig());
    trader = new V2Trader(store, exchange, new Statistics(store));
  } catch (e) {
    Log.error(e)
    Log.ifUsefulDumpAsEmail()
    throw e;
  }

  store.getTradesList().forEach(tradeMemo => {
    try {
      trader.tickerCheck(tradeMemo);
    } catch (e) {
      Log.error(e)
    }
  })

  try {
    trader.afterTickerCheck();
  } catch (e) {
    Log.error(e)
  }

  store.dumpChanges();

  try {
    new Survivors(store, exchange).updateScores();
  } catch (e) {
    Log.info(e)
  }

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
