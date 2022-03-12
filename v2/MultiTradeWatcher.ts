class MultiTradeWatcher {
  static start() {
    try {
      ScriptApp.newTrigger(CHECK_ALL.name).timeBased().everyMinutes(5).create()
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

  static watch(memo: TradeMemo) {
    try {
      const fn = memo.getKey().symbol.quantityAsset;
      ScriptApp.newTrigger(fn).timeBased().everyMinutes(5).create()
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

function CHECK_ALL() {
  const store = DefaultStore;
  const statistics = new Statistics(store);
  const trader = new V2Trader(store, new Binance(store), statistics);
  let sendLog = true;

  Object.values(DefaultStore.getOrSet("trade", {}))
    .forEach((tradeRaw: object) => {
      const tradeMemo: TradeMemo = TradeMemo.fromObject(tradeRaw);
      try {
        const result = trader.stopLossSell(tradeMemo.tradeResult.symbol);
        Log.info(result.toString())
        sendLog = result.fromExchange
        statistics.addProfit(result.profit)
        statistics.addCommission(result.commission)
      } catch (e) {
        Log.error(e)
      }
    })

  if (sendLog) {
    Log.ifUsefulDumpAsEmail()
  }
}

function Start() {
  MultiTradeWatcher.stop()
  MultiTradeWatcher.start()
  Log.ifUsefulDumpAsEmail()
}
