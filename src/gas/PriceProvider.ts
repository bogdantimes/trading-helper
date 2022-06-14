import {
  CoinName,
  enumKeys,
  ICacheProxy,
  IPriceProvider,
  PriceHoldersMap,
  PricesHolder,
  StableUSDCoin,
} from "trading-helper-lib"
import { IExchange } from "./Exchange"
import { SECONDS_IN_MIN, StableCoinMatcher, TICK_INTERVAL_MIN } from "./Common"

type StableCoinKeys = keyof typeof StableUSDCoin
type PriceMaps = { [key in StableCoinKeys]?: PriceHoldersMap }

export class PriceProvider implements IPriceProvider {
  readonly #exchange: IExchange
  readonly #cache: ICacheProxy
  readonly #priceMaps: PriceMaps

  constructor(exchange: IExchange, cache: ICacheProxy) {
    this.#exchange = exchange
    this.#cache = cache
    this.#priceMaps = this.#update()
  }

  get(stableCoin: StableUSDCoin): PriceHoldersMap {
    return this.#priceMaps[stableCoin]
  }

  getCoinNames(stableCoin: StableUSDCoin): CoinName[] {
    return Object.keys(this.#priceMaps[stableCoin])
  }

  #update(): PriceMaps {
    const updatedKey = `PriceProvider.updated`

    if (this.#cache.get(updatedKey)) {
      return this.#getPriceMapsFromCache()
    }

    const prices = this.#exchange.getPrices()
    const curPriceMaps: PriceMaps = this.#getPriceMapsFromCache()
    const updatedPriceMaps: PriceMaps = {}
    enumKeys<StableCoinKeys>(StableUSDCoin).forEach((k) => (updatedPriceMaps[k] = {}))

    Object.keys(prices).forEach((symbol) => {
      // if symbol does not end with any of the stable coins - skip it
      const matcher = new StableCoinMatcher(symbol)
      if (!matcher.matched) return

      const pricesHolder = new PricesHolder()
      pricesHolder.prices = curPriceMaps[matcher.stableCoin][matcher.coinName]?.prices
      pricesHolder.pushPrice(prices[symbol])
      updatedPriceMaps[matcher.stableCoin][matcher.coinName] = pricesHolder
    })

    Object.keys(updatedPriceMaps).forEach((stableCoin) => {
      const map = updatedPriceMaps[stableCoin]
      this.#cache.put(this.#getKey(stableCoin), JSON.stringify(map))
    })

    // Prices expire in (tick_interval - 5 seconds)
    const priceExpiration = TICK_INTERVAL_MIN * SECONDS_IN_MIN - 5
    this.#cache.put(updatedKey, `true`, priceExpiration)

    return updatedPriceMaps
  }

  #getPriceMapsFromCache(): PriceMaps {
    const priceMaps: PriceMaps = {}

    enumKeys<StableCoinKeys>(StableUSDCoin).forEach((stableCoin) => {
      priceMaps[stableCoin] = this.#getFromCache(stableCoin as StableUSDCoin)
    })

    return priceMaps
  }

  #getFromCache(stableCoin: StableUSDCoin) {
    const jsonStr = this.#cache.get(this.#getKey(stableCoin))
    const map = jsonStr ? JSON.parse(jsonStr) : {}
    Object.keys(map).forEach((key) => {
      map[key] = Object.assign(Object.create(PricesHolder.prototype), map[key])
    })
    return map
  }

  #getKey(stableCoin: string) {
    return `PriceProvider.get.${stableCoin}`
  }
}
