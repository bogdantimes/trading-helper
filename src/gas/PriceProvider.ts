import {
  CoinName,
  enumKeys,
  ICacheProxy,
  IPriceProvider,
  PriceHoldersMap,
  PricesHolder,
  StableUSDCoin,
} from "../lib"
import { IExchange } from "./Exchange"
import { SECONDS_IN_MIN, StableCoinMatcher, TICK_INTERVAL_MIN } from "./Common"

type StableCoinKeys = keyof typeof StableUSDCoin
type PriceMaps = { [key in StableCoinKeys]?: PriceHoldersMap }

export class PriceProvider implements IPriceProvider {
  static #instance: PriceProvider

  readonly #exchange: IExchange
  readonly #cache: ICacheProxy

  #priceMaps: PriceMaps

  static getInstance(exchange: IExchange, cache: ICacheProxy): PriceProvider {
    PriceProvider.#instance = PriceProvider.#instance || new PriceProvider(exchange, cache)
    return PriceProvider.#instance
  }

  constructor(exchange: IExchange, cache: ICacheProxy) {
    this.#exchange = exchange
    this.#cache = cache
    this.#priceMaps = this.#getPriceMapsFromCache()
  }

  get(stableCoin: StableUSDCoin): PriceHoldersMap {
    return this.#priceMaps[stableCoin] || {}
  }

  update() {
    this.#priceMaps = this.#update()
  }

  getCoinNames(stableCoin: StableUSDCoin): CoinName[] {
    return Object.keys(this.get(stableCoin))
  }

  #update(): PriceMaps {
    const updatedKey = `PriceProvider.updated`

    if (this.#cache.get(updatedKey)) {
      return this.#getPriceMapsFromCache()
    }

    const prices = this.#exchange.getPrices()
    const updatedPriceMaps: PriceMaps = {}
    enumKeys<StableCoinKeys>(StableUSDCoin).forEach((k) => (updatedPriceMaps[k] = {}))

    Object.keys(prices).forEach((symbol) => {
      // if symbol does not end with any of the stable coins - skip it
      const matcher = new StableCoinMatcher(symbol)
      if (!matcher.stableCoin || !matcher.coinName) return

      const pricesHolder = new PricesHolder()
      pricesHolder.prices = this.#priceMaps[matcher.stableCoin]?.[matcher.coinName]?.prices ?? []
      pricesHolder.pushPrice(prices[symbol])

      const priceMap = updatedPriceMaps[matcher.stableCoin]
      priceMap && (priceMap[matcher.coinName] = pricesHolder)
    })

    Object.keys(updatedPriceMaps).forEach((stableCoin) => {
      const map = updatedPriceMaps[stableCoin as StableUSDCoin]
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
