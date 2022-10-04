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
      } else {
        Log.alert(`Prices are not updated`);
      }
    } catch (e) {
      Log.alert(`Failed to trade: ${e.message}`);
      Log.error(e);
    }
  }
}
