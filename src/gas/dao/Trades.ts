import { type IStore, TradeMemo, TradeState } from "../../lib";
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

  getRaw(): Record<string, any> {
    if (isNode && this.memCache) {
      // performance optimization for back-testing
      return this.memCache;
    }
    return this.store.get(`Trades`) || {};
  }

  get(): Record<string, TradeMemo> {
    if (isNode && this.memCache) {
      // performance optimization for back-testing
      return this.memCache;
    }

    const trades = this.store.get(`Trades`) || {};
    // Convert raw trades to TradeMemo objects
    const tradeMemos = Object.keys(trades).reduce<Record<string, TradeMemo>>(
      (acc, key) => {
        acc[key] = TradeMemo.fromObject(trades[key]);
        return acc;
      },
      {}
    );

    this.memCache = tradeMemos;
    return tradeMemos;
  }

  getList(filter?: (state: TradeState) => boolean): TradeMemo[] {
    const trades = Object.values(this.get());
    return filter ? trades.filter((tm) => filter(tm.state)) : trades;
  }

  updateList(
    filter: (state: TradeState) => boolean,
    mutate: (trades: TradeMemo[]) => TradeMemo[]
  ) {
    this.#setListAndUnlock(mutate(this.#getListAndLock(filter)));
  }

  #getListAndLock(filter?: (state: TradeState) => boolean): TradeMemo[] {
    const tradesRaw = this.getRaw();

    const unlocked = Object.values(tradesRaw).filter(TradeMemo.isUnlocked);
    const selected = filter
      ? unlocked.filter((tm) => filter(tm.state))
      : unlocked;

    // Lock all selected
    selected.forEach(TradeMemo.lock);
    this.store.set(`Trades`, tradesRaw);

    return selected.map(TradeMemo.fromObject);
  }

  #setListAndUnlock(trades: TradeMemo[]): void {
    if (!trades.length) return;

    const tradesRaw = this.getRaw();

    trades.forEach((tm) => {
      if (TradeMemo.isLocked(tradesRaw[tm.getCoinName()])) {
        TradeMemo.unlock(tm); // it is locked - we can unlock and replace
        tradesRaw[tm.getCoinName()] = tm;
      } else {
        Log.info(`Skipped ${tm.getCoinName()}: the state was already modified`);
      }
    });

    this.store.set(`Trades`, tradesRaw);
  }

  /**
   * Calculate the total assets value based on the current value of all assets in the portfolio.
   *
   * @returns {number} The total assets value.
   */
  totalAssetsValue(): number {
    const trades = this.getList((s) => s === TradeState.BOUGHT);
    return trades.reduce((total, trade) => total + trade.currentValue, 0);
  }

  #set(tm: TradeMemo): void {
    const trades = this.getRaw();
    trades[tm.getCoinName()] = tm;
    this.store.set(`Trades`, trades);
  }

  #lockSkipMsg(coinName: string): string {
    return `${coinName} was skipped as it is already being processed by another process right now. Try again.`;
  }

  #delete(tm: TradeMemo): void {
    const trades = this.getRaw();
    if (trades[tm.getCoinName()]) {
      delete trades[tm.getCoinName()];
      if (Object.keys(trades).length === 0) {
        this.store.delete(`Trades`);
      } else {
        this.store.set(`Trades`, trades);
      }
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
    // if we cannot acquire lock within max attempts with 1 second interval - then give up
    let trades;
    const maxAttempts = 3;
    for (let i = 0; true; i++) {
      trades = this.getRaw();
      if (!TradeMemo.isLocked(trades[coinName])) break;
      if (i === maxAttempts - 1) return false;
      Utilities.sleep(1000);
    }
    if (trades[coinName]) {
      TradeMemo.lock(trades[coinName]);
      this.store.set(`Trades`, trades);
    }
    return true;
  }

  #unlockTrade(coinName: string): void {
    const trades = this.getRaw();
    if (trades[coinName]) {
      TradeMemo.unlock(trades[coinName]);
      this.store.set(`Trades`, trades);
    }
  }
}
