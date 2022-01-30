class MultiTradeWatcher {
  static watch(memo: TradeMemo) {
    try {
      const fn = memo.getKey().symbol.quantityAsset;
      ScriptApp.newTrigger(fn).timeBased().everyMinutes(1).create()
      Log.info(`Started watching ${fn}`)
    } catch (e) {
      Log.error(e)
    }
  }

  static unwatch(memo: TradeMemo) {
    const fn = memo.getKey().symbol.quantityAsset;
    const trigger = ScriptApp.getProjectTriggers().find(t => t.getHandlerFunction() == fn);
    if (trigger) {
      try {
        ScriptApp.deleteTrigger(trigger);
        Log.info(`Stopped watching ${fn}`)
      } catch (e) {
        Log.error(e)
      }
    }
  }
}

const _runtimeCtx = this;

new DefaultStore(PropertiesService.getScriptProperties())
  .getKeys()
  .filter(TradeMemoKey.isKey)
  .forEach(key => {
    _runtimeCtx[TradeMemoKey.from(key).symbol.quantityAsset] = function () {
      const store = new DefaultStore(PropertiesService.getScriptProperties());
      const tradeMemo = TradeMemo.fromJSON(store.get(key));
      if (tradeMemo) {
        let sendLog = true;
        try {
          const result = new V2Trader(store, new Binance(store)).stopLossSell(tradeMemo.tradeResult.symbol);
          Log.info(result.toString())
          sendLog = result.fromExchange
        } catch (e) {
          Log.error(e)
        }
        if (sendLog) {
          Log.ifUsefulDumpAsEmail()
        }
      }
    }
  })

function Start() {
  const store = new DefaultStore(PropertiesService.getScriptProperties());
  store.getKeys().filter(TradeMemoKey.isKey).forEach(key => {
    const tradeMemo = TradeMemo.fromJSON(store.get(key));
    if (tradeMemo) {
      MultiTradeWatcher.unwatch(tradeMemo)
      MultiTradeWatcher.watch(tradeMemo)
    }
  })
  Log.ifUsefulDumpAsEmail()
}
