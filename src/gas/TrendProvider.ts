import {
  ExchangeSymbol,
  MarketTrend,
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

  get(): MarketTrend {
    const marketTrend = this.configDao.get().MarketTrend;
    if (marketTrend !== -1) {
      return marketTrend;
    }
    const autoMarketTrend = this.cache.get(cacheKey);
    if (autoMarketTrend !== null && autoMarketTrend !== undefined) {
      return +autoMarketTrend as MarketTrend;
    }
    try {
      return this.#update();
    } catch (e) {
      return MarketTrend.SIDEWAYS;
    }
  }

  #update(): MarketTrend {
    const priceMoveToMarketTrend: { [p: number]: MarketTrend } = {
      [PriceMove.STRONG_DOWN]: MarketTrend.DOWN,
      [PriceMove.DOWN]: MarketTrend.DOWN,
      [PriceMove.NEUTRAL]: MarketTrend.SIDEWAYS,
      [PriceMove.UP]: MarketTrend.SIDEWAYS,
      [PriceMove.STRONG_UP]: MarketTrend.UP,
    };

    const limit = 7;
    // Get last 7 BTC 3d prices and measure the PriceMove
    // Use PriceMove to determine the market trend and corresponding MarketTrend
    const btc = new ExchangeSymbol(`BTC`, StableUSDCoin.BUSD);
    try {
      const prices = this.exchange.getLatestKlineOpenPrices(btc, `3d`, limit);
      const priceMove = getPriceMove(limit, prices);
      const trend = priceMoveToMarketTrend[priceMove];
      const exp = isNode ? 60 : MAX_EXPIRATION; // TODO: remove
      this.cache.put(cacheKey, trend.toString(), exp);
      return trend;
    } catch (e) {
      this.cache.put(cacheKey, MarketTrend.SIDEWAYS.toString(), MAX_EXPIRATION);
      throw e;
    }
  }
}
