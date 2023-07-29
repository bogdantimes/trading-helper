import { Log } from "./Common";
import { TradeManager } from "./TradeManager";
import { DefaultStore, LOCK_TIMEOUT } from "./Store";
import { CacheProxy } from "./CacheProxy";
import { TradesDao } from "./dao/Trades";
import { TradeState, waitTillCurrentSecond } from "../lib/index";

export class Process {
  static tick(): void {
    const manager = TradeManager.default();

    try {
      // first wait to make sure the tick is executed at the beginning of the minute (5s) is good
      // this ensures that the price data is fresh
      console.log(`tick waited ${waitTillCurrentSecond(5)} ms`);
      // Updating different tickers every tick
      // This should be the only place to call `updateTickers`.
      if (manager.updateTickers()) {
        CacheProxy.remove(`OutageCounter`);
        manager.trade(-1);
      } else {
        const outageCounter = +(CacheProxy.get(`OutageCounter`) ?? 0) + 1;
        if (outageCounter === 10 || outageCounter % 30 === 0) {
          const trades = new TradesDao(DefaultStore);
          if (trades.getList(TradeState.BOUGHT).length > 0) {
            Log.alert(
              `⚠️ Service outage detected. Please, monitor your assets manually on the exchange. This message will be repeated every 30 minutes until the service is restored.`
            );
          }
        }
        CacheProxy.put(`OutageCounter`, outageCounter.toString());
      }
    } catch (e) {
      const suppressedMsg = new RegExp(
        `ConcurrentInvocationLimitExceeded|${LOCK_TIMEOUT}`,
        `gi`
      );
      const logFn = e.message.match(suppressedMsg) ? `info` : `alert`;
      Log[logFn](`⚠️ Process tick failed: ${e.message}`);
      Log.debug(e.stack);
    }
  }
}
