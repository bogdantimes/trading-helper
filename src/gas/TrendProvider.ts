import {
  ExchangeSymbol,
  MarketCycle,
  getPriceMove,
  ICacheProxy,
  PriceMove,
  StableUSDCoin,
} from "../lib/index";
import { IExchange } from "./Exchange";
import { ConfigDao } from "./dao/Config";
import { isNode } from "browser-or-node";
import { MAX_EXPIRATION } from "./CacheProxy";

const cacheKey = `TrendProvider.get`;

export class TrendProvider {
  constructor(
    private readonly configDao: ConfigDao,
    private readonly exchange: IExchange,
    private readonly cache: ICacheProxy
  ) {}

  get(): MarketCycle {
    const marketCycle = this.configDao.get().MarketCycle;
    if (marketCycle !== -1) {
      return marketCycle;
    }
    const autoMarketCycle = this.cache.get(cacheKey);
    if (autoMarketCycle !== null && autoMarketCycle !== undefined) {
      return +autoMarketCycle as MarketCycle;
    }
    try {
      return this.#update();
    } catch (e) {
      return MarketCycle.SIDEWAYS;
    }
  }

  #update(): MarketCycle {
    const priceMoveToMarketTrend: { [p: number]: MarketCycle } = {
      [PriceMove.STRONG_DOWN]: MarketCycle.MARK_DOWN,
      [PriceMove.DOWN]: MarketCycle.MARK_DOWN,
      [PriceMove.NEUTRAL]: MarketCycle.SIDEWAYS,
      [PriceMove.UP]: MarketCycle.SIDEWAYS,
      [PriceMove.STRONG_UP]: MarketCycle.MARK_UP,
    };

    const limit = 7;
    // Get last 7 BTC 3d prices and measure the PriceMove
    // Use PriceMove to determine the market trend and corresponding MarketCycle
    const btc = new ExchangeSymbol(`BTC`, StableUSDCoin.BUSD);
    const prices = this.exchange.getLatestKlineOpenPrices(btc, `3d`, limit);
    const exp = isNode ? 60 : MAX_EXPIRATION; // TODO: remove
    if (prices.length < limit) {
      this.cache.put(cacheKey, MarketCycle.SIDEWAYS.toString(), exp);
      return MarketCycle.SIDEWAYS;
    }
    const priceMove = getPriceMove(limit, prices);
    const cycle = priceMoveToMarketTrend[priceMove];
    this.cache.put(cacheKey, cycle.toString(), exp);
    return cycle;
  }
}
