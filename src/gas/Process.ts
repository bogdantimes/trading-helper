import { Log } from "./Common";
import { TradeManager } from "./TradeManager";
import { DefaultStore, LIMIT_ERROR } from "./Store";
import { CacheProxy } from "./CacheProxy";
import { TradesDao } from "./dao/Trades";
import { TradeState, waitTillCurrentSecond } from "../lib/index";

export class Process {
  static tick(): void {
    const manager = TradeManager.default();

    function checkOutage() {
      const outageCounter = +(CacheProxy.get(`OutageCounter`) ?? 0) + 1;
      if (outageCounter === 10 || outageCounter % 30 === 0) {
        const trades = new TradesDao(DefaultStore);
        if (trades.getList(TradeState.BOUGHT).length > 0) {
          Log.alert(
            `⚠️ Service outage detected. Please, monitor your assets manually on the exchange. This message will be repeated every 30 minutes until the service is restored.`,
          );
        }
        return true;
      }
      CacheProxy.put(`OutageCounter`, outageCounter.toString());
    }

    try {
      // first wait to make sure the tick is executed at the beginning of the minute (5s) is good
      // this ensures that the price data is fresh
      console.log(`tick waited ${waitTillCurrentSecond(5)} ms`);

      // Updating different tickers every tick
      // This should be the only place to call `updateTickers`.
      if (!manager.updateTickers(-1)) {
        checkOutage();
        return;
      }

      manager.trade(-1);
      CacheProxy.remove(`OutageCounter`);
    } catch (e) {
      const logFn = e.message.match(LIMIT_ERROR) ? `info` : `alert`;
      Log[logFn](`⚠️ Process tick failed: ${e.message}`);
      Log.debug(e.stack);
      if (checkOutage()) throw e;
    }
  }
}
