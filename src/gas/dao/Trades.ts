import {
  type IStore,
  StoreDeleteProp,
  StoreNoOp,
  TradeMemo,
  TradeState,
} from "../../lib";
import { isNode } from "browser-or-node";
import { Log } from "../Common";

export class TradesDao {
  private memCache: Record<string, TradeMemo>;

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
    notFoundFn?: () => TradeMemo | undefined | null
  ): void {
    coinName = coinName.trim().toUpperCase();

    if (!coinName) {
      Log.info(`Empty coin name. Operation skipped.`);
      return;
    }

    if (!this.#lockTrade(coinName)) {
      Log.info(this.#lockSkipMsg(coinName));
      return;
    }

    try {
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
    } catch (e) {
      Log.debug(
        `${coinName}: Failed to process trade update. Error: ${JSON.stringify(
          e
        )}`
      );
    } finally {
      this.#unlockTrade(coinName);
    }
  }

  iterate(
    mutateFn: (tm: TradeMemo) => TradeMemo | undefined | null,
    state?: TradeState
  ): void {
    this.getList(state).forEach((tm) => {
      const coinName = tm.getCoinName();
      if (!this.#lockTrade(coinName)) {
        Log.info(this.#lockSkipMsg(coinName));
        return;
      }
      try {
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

  get(): Record<string, TradeMemo> {
    if (isNode && this.memCache) {
      // performance optimization for back-testing
      return this.memCache;
    }

    // Convert raw trades to TradeMemo objects
    const trades = this.store.get(`Trades`) || {};
    const tradeMemos = Object.fromEntries<TradeMemo>(
      Object.entries(trades).map(([coinName, tm]) => [
        coinName,
        TradeMemo.fromObject(tm),
      ])
    );

    this.memCache = tradeMemos;
    return tradeMemos;
  }

  getList(state?: TradeState): TradeMemo[] {
    const values = Object.values(this.get());
    return state ? values.filter((trade) => trade.stateIs(state)) : values;
  }

  /**
   * Calculate the total assets value based on the current value of all assets in the portfolio.
   *
   * @returns {number} The total assets value.
   */
  totalAssetsValue(): number {
    const trades = this.getList(TradeState.BOUGHT);
    return trades.reduce((total, trade) => total + trade.currentValue, 0);
  }

  unlockAllTrades(): void {
    this.store.update<Record<string, TradeMemo>>(`Trades`, (ts) => {
      const locked = Object.values(ts).filter(TradeMemo.isLocked);
      if (locked.length) {
        locked.forEach(TradeMemo.unlock);
        Log.alert(`ℹ️ Some trades were locked and are unlocked now`);
        return ts;
      }
      return StoreNoOp;
    });
  }

  #set(tm: TradeMemo): void {
    this.store.update<Record<string, TradeMemo>>(`Trades`, (trades) => {
      trades[tm.getCoinName()] = tm;
      return trades;
    });
  }

  #lockSkipMsg(coinName: string): string {
    return `${coinName} was skipped as it is already being processed by another process right now. Try again.`;
  }

  #delete(tm: TradeMemo): void {
    this.store.update<Record<string, TradeMemo>>(`Trades`, (trades) => {
      if (trades[tm.getCoinName()]) {
        delete trades[tm.getCoinName()];
        return Object.keys(trades).length ? trades : StoreDeleteProp;
      }
      return StoreNoOp;
    });
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
    let lockAcquired = false;

    this.store.update<Record<string, TradeMemo>>(`Trades`, (trades) => {
      if (TradeMemo.isLocked(trades[coinName])) {
        // Already locked
        return StoreNoOp;
      }

      lockAcquired = true;
      if (!trades[coinName]) {
        // Nothing to lock
        return StoreNoOp;
      }

      TradeMemo.lock(trades[coinName]);
      return trades;
    });

    return lockAcquired;
  }

  #unlockTrade(coinName: string): void {
    this.store.update<Record<string, TradeMemo>>(`Trades`, (trades) => {
      if (trades[coinName]) {
        TradeMemo.unlock(trades[coinName]);
        return trades;
      }
      return StoreNoOp;
    });
  }
}
