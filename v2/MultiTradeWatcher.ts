class MultiTradeWatcher {
  static watch(memo: TradeMemo) {
    try {
      const fn = memo.getKey().symbol.quantityAsset;
      ScriptApp.newTrigger(fn).timeBased().everyMinutes(2).create()
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

Object.values(DefaultStore.getOrSet("trade", {}))
  .forEach((tradeRaw: object) => {
    const tradeMemo: TradeMemo = TradeMemo.fromObject(tradeRaw);
    _runtimeCtx[tradeMemo.getKey().symbol.quantityAsset] = function () {
      const store = DefaultStore;
      const statistics = new Statistics(store);
      let sendLog = true;
      try {
        const result = new V2Trader(store, new Binance(store), statistics).stopLossSell(tradeMemo.tradeResult.symbol);
        Log.info(result.toString())
        sendLog = result.fromExchange
        statistics.addProfit(result.profit)
        statistics.addCommission(result.commission)
      } catch (e) {
        Log.error(e)
      }
      if (sendLog) {
        Log.ifUsefulDumpAsEmail()
      }
    }
  })

function Start() {
  Object.values(DefaultStore.getOrSet("trade", {})).forEach((tradeRaw: object) => {
    const tradeMemo = TradeMemo.fromObject(tradeRaw);
    MultiTradeWatcher.unwatch(tradeMemo)
    MultiTradeWatcher.watch(tradeMemo)
  })
  Log.ifUsefulDumpAsEmail()
}
