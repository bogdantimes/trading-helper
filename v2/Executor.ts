// Declaring the runtime context which holds the above functions.
const _runtimeCtx = this;

// @ts-ignore
AppScriptExecutor.SetContext({
  runtimeCtx: _runtimeCtx,
})

// @ts-ignore
const Executor = AppScriptExecutor.New({
  tasksGetter: {
    get() {
      // @ts-ignore
      return [{
        isValid: () => true,
        getTaskName: () => "TradeTicker",
        getScheduledTimestamp: Date.now,
        execute(args) {
          const store = new DefaultStore(PropertiesService.getScriptProperties())
          let sendLog = true
          try {
            const tradeResults = new V2Trader(store, new Binance(store)).stopLoss().filter(r => r.fromExchange);
            sendLog = tradeResults.length > 0
            tradeResults.forEach(Log.info)
          } catch (e) {
            Log.error(e)
          }

          store && store.dump()
          if (sendLog) {
            GmailApp.sendEmail("bogdan.kovalev.job@gmail.com", "Trader ticker log", Log.dump());
          }
        }
      }];
    }
  }
})

function Start() {
  Executor.restart();
  console.log(Executor.getTasks().map(t => t.getTaskName()));
}
