import {V2Trader} from "./Trader";
import {Exchange} from "./Exchange";
import {Statistics} from "./Statistics";
import {DefaultStore} from "./Store";
import {TradesQueue} from "./TradesQueue";
import {Survivors} from "./Survivors";
import {Coin} from "./shared-lib/types";

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

  try {
    trader.updateStableCoinsBalance();
  } catch (e) {
    Log.error(new Error(`Failed to read stable coins balance: ${e.message}`))
  }

  store.getTradesList()
    .filter(t => !Coin.isStable(t.getCoinName()))
    .forEach(tradeMemo => {
      try {
        // get the trade to ensure it is up-to-date,
        // as operations with other trades may have changed it
        const trade = store.getTrade(tradeMemo.tradeResult.symbol);
        if (trade) {
          trader.tickerCheck(trade);
        }
      } catch (e) {
        Log.error(e)
      }
    })

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
