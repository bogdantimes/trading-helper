import { Log } from "./Common";
import { TradeManager } from "./TradeManager";

export class Process {
  static tick(): void {
    const manager = TradeManager.default();

    try {
      // Updating prices every tick
      // This should be the only place to call `updatePrices`.
      if (manager.updatePrices()) {
        manager.trade();
      }
    } catch (e) {
      Log.alert(`Process tick failed: ${e.message}`);
      Log.error(e);
    }
  }
}
