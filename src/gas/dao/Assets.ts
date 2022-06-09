import { ICacheProxy, TradeMemo, TradeState } from "trading-helper-lib"

interface IStore {
  getOrSet(key: string, value: any): any
}

export class DeadlineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = `DeadlineError`
  }
}

export class AssetsDao {
  private readonly store: IStore
  private readonly cache: ICacheProxy

  constructor(store: IStore, cache: ICacheProxy) {
    this.store = store
    this.cache = cache
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
    const key = `TradeLocker_${coinName}`
    try {
      while (this.cache.get(key)) Utilities.sleep(200)
      const deadline = 30 // Lock for 30 seconds to give a function enough time for com w/ Binance
      this.cache.put(key, `true`, deadline)

      const trade = this.get()[coinName]
      // if trade exists - get result from mutateFn, otherwise call notFoundFn if it was provided
      // otherwise changedTrade is null.
      const changedTrade = trade ? mutateFn(trade) : notFoundFn ? notFoundFn() : null

      if (!this.cache.get(key)) {
        throw new DeadlineError(
          `Couldn't apply ${coinName} change within ${deadline} seconds deadline. Please, try again.`,
        )
      }

      if (changedTrade) {
        changedTrade.deleted ? this.#delete(changedTrade) : this.#set(changedTrade)
      }
    } finally {
      this.cache.remove(key)
    }
  }

  get(): { [p: string]: TradeMemo } {
    const cacheJson = this.cache.get(`Trades`)
    let trades = cacheJson ? JSON.parse(cacheJson) : null
    if (!trades) {
      trades = this.store.getOrSet(`trade`, {})
      this.cache.put(`Trades`, JSON.stringify(trades))
    }
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
    this.cache.put(`Trades`, JSON.stringify(trades))
  }

  #delete(tradeMemo: TradeMemo) {
    const trades = this.get()
    delete trades[tradeMemo.tradeResult.symbol.quantityAsset]
    this.cache.put(`Trades`, JSON.stringify(trades))
  }
}
