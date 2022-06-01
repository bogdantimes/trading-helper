import { enumKeys, PricesHolder, StableUSDCoin } from "trading-helper-lib"
import { IExchange } from "./Exchange"
import { ICacheProxy } from "./CacheProxy"
import { SECONDS_IN_MIN, StableCoinMatcher, TICK_INTERVAL_MIN } from "./Common"

export type CoinName = string

export interface PriceHoldersMap {
  [key: CoinName]: PricesHolder
}

export interface IPriceProvider {
  get(stableCoin: StableUSDCoin): PriceHoldersMap
}

export class PriceProvider implements IPriceProvider {
  private readonly exchange: IExchange
  private readonly cache: ICacheProxy

  constructor(exchange: IExchange, cache: ICacheProxy) {
    this.exchange = exchange
    this.cache = cache
  }

  public get(stableCoin: StableUSDCoin): PriceHoldersMap {
    this.update()
    return this.getFromCache(stableCoin)
  }

  private getFromCache(stableCoin: StableUSDCoin) {
    const jsonStr = this.cache.get(this.getKey(stableCoin))
    const map = jsonStr ? JSON.parse(jsonStr) : {}
    Object.keys(map).forEach(key => {
      map[key] = Object.assign(Object.create(PricesHolder.prototype), map[key])
    })
    return map
  }

  private update(): void {
    const updatedKey = `PriceProvider.updated`
    if (this.cache.get(updatedKey)) return

    const prices = this.exchange.getPrices()
    const allMaps = {}

    enumKeys(StableUSDCoin).forEach(stableCoin => {
      allMaps[stableCoin] = this.getFromCache(stableCoin as StableUSDCoin)
    })

    Object.keys(prices).forEach(symbol => {
      // if symbol does not end with any of the stable coins - skip it
      const matcher = new StableCoinMatcher(symbol)
      if (!matcher.matched) return

      const pricesHolder = new PricesHolder()
      pricesHolder.prices = allMaps[matcher.stableCoin][matcher.coinName]?.prices
      pricesHolder.pushPrice(prices[symbol])
      allMaps[matcher.stableCoin][matcher.coinName] = pricesHolder
    })

    Object.keys(allMaps).forEach(stableCoin => {
      const map = allMaps[stableCoin]
      this.cache.put(this.getKey(stableCoin), JSON.stringify(map))
    })

    // Prices expire in (tick_interval - 5 seconds)
    const priceExpiration = TICK_INTERVAL_MIN * SECONDS_IN_MIN - 5
    this.cache.put(updatedKey, `true`, priceExpiration)
  }

  private getKey(stableCoin: string) {
    return `PriceProvider.get.${stableCoin}`
  }
}
