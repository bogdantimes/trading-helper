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
      return FGI.NEUTRAL;
    }
  }

  #update(): FGI {
    const priceMoveToMarketTrend: { [p: number]: FGI } = {
      [PriceMove.STRONG_UP]: FGI.BULLISH,
      [PriceMove.UP]: FGI.BULLISH,
      [PriceMove.NEUTRAL]: FGI.NEUTRAL,
      [PriceMove.DOWN]: FGI.BEARISH,
      [PriceMove.STRONG_DOWN]: FGI.BEARISH,
    };

    const limit = 3;
    // Get last 3 BTC weekly prices and measure the PriceMove
    const btc = new ExchangeSymbol(`BTC`, StableUSDCoin.BUSD);
    const prices = this.exchange.getLatestKlineOpenPrices(btc, `1w`, limit);
    const exp = isNode ? 60 : MAX_EXPIRATION; // TODO: remove
    if (prices.length < limit) {
      this.cache.put(`AutoFGI`, FGI.NEUTRAL.toString(), exp);
      return FGI.NEUTRAL;
    }
    const priceMove = getPriceMove(limit, prices);
    const fgi = priceMoveToMarketTrend[priceMove];
    this.cache.put(`AutoFGI`, fgi.toString(), exp);
    return fgi;
  }
}
