import {CoinStats} from "./CoinStats";
import {Binance, IExchange} from "./Binance";
import {IStore} from "./Store";

export class BinanceStats implements IExchange {
  private binance: Binance;
  private coinStats: CoinStats;

  constructor(store: IStore) {
    this.binance = new Binance(store);
    this.coinStats = new CoinStats();
  }

  getFreeAsset(assetName: string): number {
    return this.binance.getFreeAsset(assetName);
  }

  getPrice(symbol: ExchangeSymbol): number {
    return this.coinStats.getPrice(symbol);
  }

  getPrices(): { [p: string]: number } {
    return this.coinStats.getPrices();
  }

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult {
    return this.binance.marketBuy(symbol, cost);
  }

  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult {
    return this.binance.marketSell(symbol, quantity);
  }
}
