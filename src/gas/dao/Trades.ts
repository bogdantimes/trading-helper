import {
  type CoinName,
  type IStore,
  StoreDeleteProp,
  StoreNoOp,
  TradeMemo,
  TradeState,
} from "../../lib";
import { Log } from "../Common";
import { LOCK_TIMEOUT } from "../Store";

export class TradesDao {
  constructor(private readonly store: IStore) {}

  has(coinName: CoinName): boolean {
    return !!this.getAll()[coinName.trim().toUpperCase()];
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
    notFoundFn?: () => TradeMemo | undefined | null,
  ): void {
    coinName = coinName.trim().toUpperCase();

    if (!coinName) {
      Log.info(`Empty coin name. Operation skipped.`);
      return;
    }

    try {
      this.store.update<Record<string, TradeMemo>>(`Trades`, (trades) => {
        trades = trades || {};
        const tm = trades[coinName];
        // if trade exists - get result from mutateFn, otherwise call notFoundFn if it was provided
        // otherwise changedTrade is null.
        const changedTrade = tm
          ? mutateFn(TradeMemo.fromObject(tm))
          : notFoundFn
          ? notFoundFn()
          : null;

        if (!changedTrade) {
          return StoreNoOp;
        }
        if (changedTrade.deleted) {
          delete trades[coinName];
        } else {
          trades[coinName] = changedTrade;
        }

        // TODO: double check why deleting is important
        return Object.keys(trades).length ? trades : StoreDeleteProp;
      });
    } catch (e) {
      const suppressedMsg = new RegExp(LOCK_TIMEOUT, `gi`);
      const logFn = e.message.match(suppressedMsg) ? `info` : `alert`;
      Log[logFn](`⚠️ ${coinName}: Failed to process. Error: ${e.message}`);
      Log.debug(e.stack);
    }
  }

  iterate(
    mutateFn: (tm: TradeMemo) => TradeMemo | undefined | null,
    state?: TradeState,
  ): void {
    const tradesRaw = this.store.get<object>(`Trades`) || {};

    Object.keys(tradesRaw).forEach((coinName) => {
      try {
        this.store.update<Record<string, TradeMemo>>(`Trades`, (trades) => {
          if (!trades?.[coinName]) {
            return StoreNoOp;
          }

          const tm = TradeMemo.fromObject(trades[coinName]);
          if (state && !tm.stateIs(state)) {
            return StoreNoOp;
          }

          const changedTrade = mutateFn(tm);

          if (!changedTrade) {
            return StoreNoOp;
          }

          if (changedTrade.deleted) {
            delete trades[coinName];
          } else {
            trades[coinName] = changedTrade;
          }

          // TODO: double check why deleting is important
          return Object.keys(trades).length ? trades : StoreDeleteProp;
        });
      } catch (e) {
        const suppressedMsg = new RegExp(LOCK_TIMEOUT, `gi`);
        const logFn = e.message.match(suppressedMsg) ? `info` : `alert`;
        Log[logFn](`⚠️ ${coinName}: Failed to process. Error: ${e.message}`);
        Log.debug(e.stack);
      }
    });
  }

  getAll(): Record<string, TradeMemo> {
    // Convert raw trades to TradeMemo objects
    const trades = this.store.get<object>(`Trades`) || {};
    return Object.fromEntries<TradeMemo>(
      Object.entries(trades).map(([coinName, tm]) => [
        coinName,
        TradeMemo.fromObject(tm),
      ]),
    );
  }

  get(coinName: CoinName): TradeMemo | undefined {
    coinName = coinName.trim().toUpperCase();
    return this.getAll()[coinName];
  }

  getList(state?: TradeState): TradeMemo[] {
    const values = Object.values(this.getAll());
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
}
