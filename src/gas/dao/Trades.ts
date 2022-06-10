import { TradeMemo, TradeState } from "trading-helper-lib"
import { IStore } from "../Store"
import { Log } from "../Common"

export class TradesDao {
  private readonly store: IStore

  constructor(store: IStore) {
    this.store = store
  }

  has(coinName: string): boolean {
    return !!this.get()[coinName]
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
    notFoundFn?: () => TradeMemo | undefined,
  ): void {
    coinName = coinName.toUpperCase()
    const lock = LockService.getScriptLock()
    try {
      if (!lock.tryLock(30000)) {
        Log.error(new Error(`Failed to acquire lock for ${coinName}`))
        return
      }

      const trade = this.get()[coinName]
      // if trade exists - get result from mutateFn, otherwise call notFoundFn if it was provided
      // otherwise changedTrade is null.
      const changedTrade = trade ? mutateFn(trade) : notFoundFn ? notFoundFn() : null

      if (changedTrade) {
        changedTrade.deleted ? this.#delete(changedTrade) : this.#set(changedTrade)
      }
    } finally {
      lock.releaseLock()
    }
  }

  get(): { [p: string]: TradeMemo } {
    const trades = this.store.getOrSet(`trade`, {})
    // Convert raw trades to TradeMemo objects
    return Object.keys(trades).reduce((acc, key) => {
      acc[key] = TradeMemo.fromObject(trades[key])
      return acc
    }, {})
  }

  getList(state?: TradeState): TradeMemo[] {
    const values = Object.values(this.get())
    return state ? values.filter((trade) => trade.stateIs(state)) : values
  }

  #set(tradeMemo: TradeMemo) {
    const trades = this.get()
    trades[tradeMemo.tradeResult.symbol.quantityAsset] = tradeMemo
    this.store.set(`Trades`, JSON.stringify(trades))
  }

  #delete(tradeMemo: TradeMemo) {
    const trades = this.get()
    delete trades[tradeMemo.tradeResult.symbol.quantityAsset]
    this.store.set(`Trades`, JSON.stringify(trades))
  }
}
