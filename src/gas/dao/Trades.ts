import { TradeMemo, TradeState, IStore } from "../../lib"
import { execute } from "../Common"
import { isNode } from "browser-or-node"

export class TradesDao {
  private readonly store: IStore
  private memCache: { [p: string]: TradeMemo }

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
    const lock = this.#acquireTradeLock(coinName)
    try {
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
    if (isNode && this.memCache) {
      // performance optimization for back-testing
      return this.memCache
    }

    const trades = this.store.getOrSet(`Trades`, {})
    // Convert raw trades to TradeMemo objects
    const tradeMemos = Object.keys(trades).reduce((acc, key) => {
      acc[key] = TradeMemo.fromObject(trades[key])
      return acc
    }, {} as { [p: string]: TradeMemo })

    this.memCache = tradeMemos
    return tradeMemos
  }

  getList(state?: TradeState): TradeMemo[] {
    const values = Object.values(this.get())
    return state ? values.filter((trade) => trade.stateIs(state)) : values
  }

  #set(tradeMemo: TradeMemo) {
    const trades = this.get()
    trades[tradeMemo.tradeResult.symbol.quantityAsset] = tradeMemo
    this.store.set(`Trades`, trades)
  }

  #delete(tradeMemo: TradeMemo) {
    const trades = this.get()
    delete trades[tradeMemo.tradeResult.symbol.quantityAsset]
    this.store.set(`Trades`, trades)
  }

  #acquireTradeLock(coinName: string): GoogleAppsScript.Lock.Lock {
    if (isNode) {
      return lockMock
    }

    const lock = LockService.getScriptLock()
    try {
      execute({
        attempts: 4,
        interval: 1000, // 1 second
        runnable: () => lock.waitLock(5000), // 5 seconds
      })
      return lock
    } catch (e: any) {
      throw new Error(`Failed to acquire lock for ${coinName}: ${e?.message}`)
    }
  }
}

const lockMock = {
  hasLock(): boolean {
    return false
  },
  tryLock(): boolean {
    return true
  },
  waitLock(): void {
    // do nothing
  },
  releaseLock() {
    // do nothing
  },
}
