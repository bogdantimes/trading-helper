// Declaring the runtime context which holds the above functions.
import TriggerSource = GoogleAppsScript.Script.TriggerSource;

const _runtimeCtx = this;

class MultiTradeWatcher {
  static init() {
    const store = new DefaultStore(PropertiesService.getScriptProperties());
    store.getKeys().filter(TradeMemoKey.isKey).forEach(key => {
      _runtimeCtx[key] = function () {
        const tradeMemo = TradeMemo.fromJSON(store.get(key));
        if (tradeMemo) {
          try {
            const result = new V2Trader(store, new Binance(store)).stopLossSell(tradeMemo.tradeResult.symbol);
            if (result.fromExchange) {
              Log.info(result.toString())
            }
          } catch (e) {
            Log.error(e)
          }
          Log.ifUsefulDumpAsEmail()
        }
      }
    })
  }

  static watch(symbol: ExchangeSymbol) {
    try {
      ScriptApp.newTrigger(symbol.toString()).timeBased().everyMinutes(1)
      Log.info(`Started watching ${symbol} trade`)
    } catch (e) {
      Log.error(e)
    }
  }

  static unwatch(symbol: ExchangeSymbol) {
    const trigger = ScriptApp.getProjectTriggers().find(trigger => trigger.getHandlerFunction() == symbol.toString());
    if (trigger) {
      try {
        ScriptApp.deleteTrigger(trigger);
        Log.info(`Stopped watching ${symbol} trade`)
      } catch (e) {
        Log.error(e)
      }
    }
  }
}

MultiTradeWatcher.init()
