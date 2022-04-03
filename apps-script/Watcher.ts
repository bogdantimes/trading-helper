import {TradeMemo} from "./TradeMemo";
import {V2Trader} from "./Trader";
import {BinanceStats} from "./BinanceStats";
import {Statistics} from "./Statistics";
import {DefaultStore, getConfig, getTrades} from "./Store";

class Watcher {
  static start() {
    try {
      ScriptApp.newTrigger(CHECK_ALL.name).timeBased().everyMinutes(1).create()
      Log.info(`Started ${CHECK_ALL.name}`)
    } catch (e) {
      Log.error(e)
    }
  }

  static stop() {
    const trigger = ScriptApp.getProjectTriggers().find(t => t.getHandlerFunction() == CHECK_ALL.name);
    if (trigger) {
      try {
        ScriptApp.deleteTrigger(trigger);
        Log.info(`Stopped ${CHECK_ALL.name}`)
      } catch (e) {
        Log.error(e)
      }
    }
  }
}

function CHECK_ALL() {
  const store = DefaultStore;
  const statistics = new Statistics(store);
  const trader = new V2Trader(store, new BinanceStats(getConfig()), statistics);
  let sendLog = true;

  Object.values(getTrades())
    .forEach((tradeRaw: object) => {
      const tradeMemo: TradeMemo = TradeMemo.fromObject(tradeRaw);
      try {
        const result = trader.stopLossSell(tradeMemo.tradeResult.symbol);
        Log.info(result.toString())
        sendLog = result.fromExchange
      } catch (e) {
        Log.error(e)
      }
    })

  if (sendLog) {
    Log.ifUsefulDumpAsEmail()
  }
}

function Start() {
  Watcher.stop()
  Watcher.start()
  Log.ifUsefulDumpAsEmail()
}
