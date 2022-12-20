import { IStore, TradeMemo, TradeState } from "../../lib";
import { isNode } from "browser-or-node";
import { Log } from "../Common";

export class TradesDao {
  private memCache: { [p: string]: TradeMemo };

  constructor(private readonly store: IStore) {}

  has(coinName: string): boolean {
    return !!this.get()[coinName];
  }

  /**
   * update function provides a way to update the trade memo object.
   *
   * It locks the trade memo object for the duration of the mutation function but no more than 30 seconds.
   *
   * It expects a coinName and a mutate function. The mutate function receives either an existing trade memo object
   * from a store or if not found, calls the optional notFoundFn callback.
   *
   * Mutation function can return an updated trade memo object or undefined/null value.
   * If returned trade memo object has deleted flag set to true, this trade memo will be deleted.
   * If undefined/null value is returned, the trade memo will not be updated.
   *
   * @param coinName
   * @param mutateFn
   * @param notFoundFn?
   */
  update(
    coinName: string,
    mutateFn: (tm: TradeMemo) => TradeMemo | undefined | null,
    notFoundFn?: () => TradeMemo | undefined
  ): void {
    try {
      coinName = coinName.toUpperCase();

      if (!this.#lockTrade(coinName)) {
        Log.info(this.#lockSkipMsg(coinName));
        return;
      }

      const trade = this.get()[coinName];
      // if trade exists - get result from mutateFn, otherwise call notFoundFn if it was provided
      // otherwise changedTrade is null.
      const changedTrade = trade
        ? mutateFn(trade)
        : notFoundFn
        ? notFoundFn()
        : null;

      if (changedTrade) {
        changedTrade.deleted
          ? this.#delete(changedTrade)
          : this.#set(changedTrade);
      }
    } finally {
      this.#unlockTrade(coinName);
    }
  }

  iterate(mutateFn: (tm: TradeMemo) => TradeMemo | undefined | null): void {
    this.getList().forEach((tm) => {
      const coinName = tm.getCoinName();
      try {
        if (!this.#lockTrade(coinName)) {
          Log.info(this.#lockSkipMsg(coinName));
          return;
        }
        const changedTrade = mutateFn(tm);
        if (changedTrade) {
          changedTrade.deleted
            ? this.#delete(changedTrade)
            : this.#set(changedTrade);
        }
      } finally {
        this.#unlockTrade(coinName);
      }
    });
  }

  get(): { [p: string]: TradeMemo } {
    if (isNode && this.memCache) {
      // performance optimization for back-testing
      return this.memCache;
    }

    const trades = this.store.get(`Trades`) || {};
    // Convert raw trades to TradeMemo objects
    const tradeMemos = Object.keys(trades).reduce<{ [p: string]: TradeMemo }>(
      (acc, key) => {
        acc[key] = TradeMemo.fromObject(trades[key]);
        return acc;
      },
      {}
    );

    this.memCache = tradeMemos;
    return tradeMemos;
  }

  getList(state?: TradeState): TradeMemo[] {
    const values = Object.values(this.get());
    return state ? values.filter((trade) => trade.stateIs(state)) : values;
  }

  #set(tm: TradeMemo): void {
    const trades = this.get();
    trades[tm.getCoinName()] = tm;
    this.store.set(`Trades`, trades);
  }

  #lockSkipMsg(coinName: string): string {
    return `${coinName} was skipped as it is already being processed by another process right now. Try again.`;
  }

  #delete(tm: TradeMemo): void {
    const trades = this.get();
    if (trades[tm.getCoinName()]) {
      delete trades[tm.getCoinName()];
      this.store.set(`Trades`, trades);
    }
  }

  /**
   * #lockTrade and #unlockTrade are used to prevent multiple processes from updating the same trade memo object.
   * This is needed because Google Apps Script runs every 1 minute and if the process takes longer than 1 minute
   * to complete, it will be started again.
   * @param coinName
   * @private
   * @returns {boolean} true if the trade memo was locked, false if it was already locked
   */
  #lockTrade(coinName: string): boolean {
    // if we cannot acquire lock within 2 attempts with 1 second interval - then give up
    let trades;
    const maxAttempts = 2;
    for (let i = 0; i < maxAttempts; i++) {
      trades = this.get();
      if (!trades[coinName]?.locked) break;
      if (i === maxAttempts - 1) return false;
      Utilities.sleep(1000);
    }
    if (trades[coinName]) {
      trades[coinName].lock();
      this.store.set(`Trades`, trades);
    }
    return true;
  }

  #unlockTrade(coinName: string): void {
    const trades = this.get();
    if (trades[coinName]) {
      trades[coinName].unlock();
      this.store.set(`Trades`, trades);
    }
  }
}
