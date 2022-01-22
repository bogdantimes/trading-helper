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

          try {
            new V2Trader(store, new Binance(store)).stopLoss().forEach(Log.info)
          } catch (e) {
            Log.error(e)
          }

          store && store.dump()
          GmailApp.sendEmail("bogdan.kovalev.job@gmail.com", "Trader ticker log", Log.dump());
        }
      }];
    }
  }
})

function Start() {
  Executor.restart();
  console.log(Executor.getTasks().map(t => t.getTaskName()));
}
