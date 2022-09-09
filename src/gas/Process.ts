import { Log, StopWatch } from "./Common";
import { TradeManager } from "./TradeManager";

export class Process {
  static tick(): void {
    const stopWatch = new StopWatch((...args) => Log.debug(...args));

    const manager = TradeManager.default();
    const priceProvider = manager.priceProvider;

    // Updating prices every tick
    // This should be the only place to call `update` on the price provider.
    stopWatch.start(`Prices update`);
    priceProvider.update();
    stopWatch.stop();

    try {
      stopWatch.start(`Trades check`);
      manager.trade();
      stopWatch.stop();
    } catch (e) {
      Log.alert(`Failed to trade: ${e.message}`);
      Log.error(e);
    }
  }
}
