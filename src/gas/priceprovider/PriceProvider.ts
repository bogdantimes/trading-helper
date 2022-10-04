import {
  enumKeys,
  ICacheProxy,
  IPriceProvider,
  PriceHoldersMap,
  PricesHolder,
  StableUSDCoin,
} from "../../lib/index";
import {
  SECONDS_IN_MIN,
  StableCoinMatcher,
  TICK_INTERVAL_MIN,
} from "../Common";
import { TraderPlugin } from "../traders/plugin/api";
import { CacheProxy } from "../CacheProxy";

type StableCoinKeys = keyof typeof StableUSDCoin;
type PriceMaps = { [key in StableCoinKeys]?: PriceHoldersMap };

export class PriceProvider implements IPriceProvider {
  static #instance: PriceProvider;

  #priceMaps: PriceMaps;

  static default(): PriceProvider {
    PriceProvider.#instance =
      PriceProvider.#instance ||
      new PriceProvider(global.TradingHelperLibrary, CacheProxy);
    return PriceProvider.#instance;
  }

  constructor(
    private readonly plugin: TraderPlugin,
    private readonly cache: ICacheProxy
  ) {
    this.#priceMaps = this.#getPriceMapsFromCache();
  }

  get(stableCoin: StableUSDCoin): PriceHoldersMap {
    return this.#priceMaps[stableCoin] || {};
  }

  update(): void {
    this.#priceMaps = this.#update();
  }

  #update(): PriceMaps {
    const updatedKey = `PriceProvider.updated`;

    if (this.cache.get(updatedKey)) {
      return this.#priceMaps;
    }

    const prices = this.plugin.getPrices();

    if (Object.keys(prices).length === 0) {
      return this.#priceMaps;
    }

    const updatedPriceMaps: PriceMaps = {};
    enumKeys<StableCoinKeys>(StableUSDCoin).forEach(
      (k) => (updatedPriceMaps[k] = {})
    );

    Object.keys(prices).forEach((symbol) => {
      const matcher = new StableCoinMatcher(symbol);
      if (!matcher.stableCoin || !matcher.coinName) return;

      const pricesHolder = new PricesHolder();
      pricesHolder.prices =
        this.#priceMaps[matcher.stableCoin]?.[matcher.coinName]?.prices ?? [];
      pricesHolder.pushPrice(prices[symbol]);

      const priceMap = updatedPriceMaps[matcher.stableCoin];
      priceMap && (priceMap[matcher.coinName] = pricesHolder);
    });

    Object.keys(updatedPriceMaps).forEach((stableCoin) => {
      const map = updatedPriceMaps[stableCoin as StableUSDCoin];
      this.cache.put(this.#getKey(stableCoin), JSON.stringify(map));
    });

    // Prices expire in (tick_interval - 5 seconds)
    const priceExpiration = TICK_INTERVAL_MIN * SECONDS_IN_MIN - 5;
    this.cache.put(updatedKey, `true`, priceExpiration);

    return updatedPriceMaps;
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
    return `PriceProvider.get.${stableCoin}`;
  }
}
