import {
  enumKeys,
  type ICacheProxy,
  type IPriceProvider,
  type PriceHoldersMap,
  PricesHolder,
  type StableCoinKeys,
  StableCoinMatcher,
  StableUSDCoin,
} from "../../lib/index";
import { SECONDS_IN_MIN, TICK_INTERVAL_MIN } from "../Common";
import { type TraderPlugin } from "../traders/plugin/api";
import { CacheProxy } from "../CacheProxy";

type PriceMaps = { [key in StableCoinKeys]?: PriceHoldersMap };

export class PriceProvider implements IPriceProvider {
  static #instance: PriceProvider;

  #name = `default`;
  #priceMaps: PriceMaps;
  // Prices expire in (tick_interval - 5 seconds)
  #expiration = TICK_INTERVAL_MIN * SECONDS_IN_MIN - 5;
  readonly #maxCap?: number;
  readonly #fillIn?: boolean;

  static default(
    plugin = global.TradingHelperLibrary,
    cache = CacheProxy,
  ): PriceProvider {
    PriceProvider.#instance =
      PriceProvider.#instance || new PriceProvider(plugin, cache);
    return PriceProvider.#instance;
  }

  constructor(
    private readonly plugin: TraderPlugin,
    private readonly cache: ICacheProxy,
    maxCap?: number,
    fillIn?: boolean,
  ) {
    this.#priceMaps = this.#getPriceMapsFromCache();
    this.#maxCap = maxCap;
    this.#fillIn = fillIn;
  }

  get(stableCoin: StableUSDCoin): PriceHoldersMap {
    return this.#priceMaps[stableCoin] ?? {};
  }

  update(): boolean {
    this.#priceMaps = this.#update();
    return !!this.cache.get(`PriceProvider.${this.#name}.updated`);
  }

  setAll(priceMaps: PriceMaps) {
    if (priceMaps && Object.keys(priceMaps).length > 0) {
      this.#saveMaps(priceMaps);
    }
  }

  #update(): PriceMaps {
    const updatedKey = `PriceProvider.${this.#name}.updated`;

    if (this.cache.get(updatedKey)) {
      return this.#priceMaps;
    }

    const prices = this.plugin.getPrices();

    if (Object.keys(prices).length === 0) {
      return this.#priceMaps;
    }

    const updatedPriceMaps: PriceMaps = {};
    enumKeys<StableCoinKeys>(StableUSDCoin).forEach(
      (k) => (updatedPriceMaps[k] = {}),
    );

    Object.keys(prices).forEach((symbol) => {
      const matcher = new StableCoinMatcher(symbol);
      if (!matcher.stableCoin || !matcher.coinName) return;

      const pricesHolder = new PricesHolder(this.#maxCap, this.#fillIn);
      pricesHolder.prices =
        this.#priceMaps[matcher.stableCoin]?.[matcher.coinName]?.prices ?? [];
      pricesHolder.pushPrice(prices[symbol]);

      const priceMap = updatedPriceMaps[matcher.stableCoin];
      priceMap && (priceMap[matcher.coinName] = pricesHolder);
    });

    this.#saveMaps(updatedPriceMaps);

    this.cache.put(updatedKey, `true`, this.#expiration);

    return updatedPriceMaps;
  }

  #saveMaps(priceMaps: PriceMaps) {
    Object.keys(priceMaps).forEach((stableCoin) => {
      const map = priceMaps[stableCoin as StableUSDCoin];
      this.cache.put(this.#getKey(stableCoin), JSON.stringify(map));
    });
  }

  #getPriceMapsFromCache(): PriceMaps {
    const priceMaps: PriceMaps = {};

    enumKeys<StableCoinKeys>(StableUSDCoin).forEach((stableCoin) => {
      priceMaps[stableCoin] = this.#getFromCache(stableCoin as StableUSDCoin);
    });

    return priceMaps;
  }

  #getFromCache(stableCoin: StableUSDCoin): PriceHoldersMap {
    const jsonStr = this.cache.get(this.#getKey(stableCoin));
    const map = jsonStr ? JSON.parse(jsonStr) : {};
    Object.keys(map).forEach((key) => {
      map[key] = Object.assign(Object.create(PricesHolder.prototype), map[key]);
    });
    return map;
  }

  #getKey(stableCoin: string): string {
    return `PriceProvider.${this.#name}.get.${stableCoin}`;
  }

  keepAlive(): void {
    this.#saveMaps(this.#getPriceMapsFromCache());
  }
}
