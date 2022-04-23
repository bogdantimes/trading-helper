import {IExchange} from "./Binance";
import {ExchangeSymbol, TradeResult} from "./TradeResult";

export class CoinStats implements IExchange {

  private static readonly API_URL = 'https://api.coinstats.app/public/v1';

  getFreeAsset(assetName: string): number {
    throw new Error('Method not implemented.');
  }

  getPrice(symbol: ExchangeSymbol): number {
    const query = `${CoinStats.API_URL}/tickers?exchange=binance&pair=${symbol.quantityAsset}-${symbol.priceAsset}`;
    const tickers = execute({context: '', runnable: () => UrlFetchApp.fetch(query)})
    const data = JSON.parse(tickers.getContentText());
    return data.tickers[0].price;
  }

  getPrices(): { [p: string]: number } {
    const tickers = execute({
      context: '',
      runnable: () => UrlFetchApp.fetch(CoinStats.API_URL + '/tickers?exchange=binance')
    })
    const data = JSON.parse(tickers.getContentText());
    return data.tickers.reduce((acc, ticker) => {
      acc[ticker.from + ticker.to] = ticker.price;
      return acc;
    }, {});
  }

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult {
    throw new Error('Method not implemented.');
  }

  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult {
    throw new Error('Method not implemented.');
  }

}
