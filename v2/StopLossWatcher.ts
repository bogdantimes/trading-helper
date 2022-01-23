// Declaring the runtime context which holds the above functions.
const _runtimeCtx = this;

// @ts-ignore
AppScriptExecutor.SetContext({
  runtimeCtx: _runtimeCtx,
  debugMsg: (arg) => Log.debug(arg)
})

// @ts-ignore
const StopLossWatcher = AppScriptExecutor.New({
  tasksGetter: {
    get() {
      return [{
        isValid: () => true,
        getTaskName: () => "StopLossCheck",
        getScheduledTimestamp: () => Date.now() - 1000,
        execute(args) {
          const store = new DefaultStore(PropertiesService.getScriptProperties())
          let sendLog = true
          try {
            const tradeResults = new V2Trader(store, new Binance(store)).stopLoss().filter(r => r.fromExchange);
            sendLog = tradeResults.length > 0
            tradeResults.forEach(r => Log.info(r))
          } catch (e) {
            Log.error(e)
          }

          store && store.dump()
          if (sendLog) {
            GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), "Trader ticker log", Log.dump());
          }
        }
      }];
    }
  }
})


/**
 * StopLossWatcher starts automatically by the V2Trader in {@link V2Trader.buy}.
 * Also, it stops in ${@link V2Trader.stopLoss} if no active trades to watch left.
 *
 * You don't need to start it manually unless there's some reason.
 */
function Start() {
  try {
    StopLossWatcher.restart();
    Log.info(StopLossWatcher.getTasks().map(t => t.getTaskName()));
  } finally {
    GmailApp.sendEmail(Session.getEffectiveUser().getEmail(), "StopLossWatcher restart", Log.dump());
  }
}
