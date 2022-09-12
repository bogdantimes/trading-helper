import { Log, StopWatch } from "./Common";
import { TradeManager } from "./TradeManager";

export class Process {
  static tick(): void {
    const stopWatch = new StopWatch((...args) => Log.debug(...args));
    const manager = TradeManager.default();

    try {
      // Updating prices every tick
      // This should be the only place to call `updatePrices`.
      stopWatch.start(`Updating prices`);
      manager.updatePrices();
      stopWatch.stop();
      stopWatch.start(`Trading`);
      manager.trade();
      stopWatch.stop();
    } catch (e) {
      Log.alert(`Failed to trade: ${e.message}`);
      Log.error(e);
    }
  }
}
