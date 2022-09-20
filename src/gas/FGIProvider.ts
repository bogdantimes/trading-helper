import {
  ExchangeSymbol,
  FGI,
  getPriceMove,
  ICacheProxy,
  PriceMove,
  StableUSDCoin,
} from "../lib/index";
import { IExchange } from "./Exchange";
import { ConfigDao } from "./dao/Config";
import { isNode } from "browser-or-node";
import { MAX_EXPIRATION } from "./CacheProxy";

export class FGIProvider {
  constructor(
    private readonly configDao: ConfigDao,
    private readonly exchange: IExchange,
    private readonly cache: ICacheProxy
  ) {}

  get(): FGI {
    const userFGI = this.configDao.get().FearGreedIndex;
    if (userFGI !== -1) {
      return userFGI;
    }
    const autoFGI = this.cache.get(`AutoFGI`);
    if (autoFGI !== null && autoFGI !== undefined) {
      return +autoFGI as FGI;
    }
    try {
      return this.#update();
    } catch (e) {
      return FGI.BALANCED;
    }
  }

  #update(): FGI {
    const priceMoveToMarketTrend: { [p: number]: FGI } = {
      [PriceMove.STRONG_UP]: FGI.BULLISH,
      [PriceMove.UP]: FGI.BALANCED,
      [PriceMove.NEUTRAL]: FGI.BALANCED,
      [PriceMove.DOWN]: FGI.BALANCED,
      [PriceMove.STRONG_DOWN]: FGI.BEARISH,
    };

    const limit = 7;
    // Get last 7 BTC 3d prices and measure the PriceMove
    // Use PriceMove to determine the market trend and corresponding FGI
    const btc = new ExchangeSymbol(`BTC`, StableUSDCoin.BUSD);
    const prices = this.exchange.getLatestKlineOpenPrices(btc, `3d`, limit);
    const exp = isNode ? 60 : MAX_EXPIRATION; // TODO: remove
    if (prices.length < limit) {
      this.cache.put(`AutoFGI`, FGI.BALANCED.toString(), exp);
      return FGI.BALANCED;
    }
    const priceMove = getPriceMove(limit, prices);
    const fgi = priceMoveToMarketTrend[priceMove];
    this.cache.put(`AutoFGI`, fgi.toString(), exp);
    return fgi;
  }
}
