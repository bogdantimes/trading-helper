import {CoinStats} from "./CoinStats";
import {Binance, IExchange} from "./Binance";
import {Config} from "./Store";
import {ExchangeSymbol, TradeResult} from "./TradeResult";
import {CoinGecko} from "./CoinGecko";

export class DefaultExchange implements IExchange {
  private exchange: Binance;
  private spotPriceProvider: CoinStats;

  constructor(config: Config) {
    this.exchange = new Binance(config);
    this.spotPriceProvider = new CoinGecko(config.PriceAsset, 'binance');
  }

  getFreeAsset(assetName: string): number {
    return this.exchange.getFreeAsset(assetName);
  }

  getPrice(symbol: ExchangeSymbol): number {
    return this.spotPriceProvider.getPrice(symbol);
  }

  getPrices(symbols?: ExchangeSymbol[]): { [p: string]: number } {
    return this.spotPriceProvider.getPrices(symbols);
  }

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult {
    return this.exchange.marketBuy(symbol, cost);
  }

  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult {
    return this.exchange.marketSell(symbol, quantity);
  }
}
