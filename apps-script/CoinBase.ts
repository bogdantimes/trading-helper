import {IExchange} from "./Binance";
import {ExchangeSymbol, TradeResult} from "./TradeResult";

export class CoinBase implements IExchange {

  private static readonly API_URL = 'https://api.coinbase.com/v2';
  private readonly stableCoin: string;

  constructor(stableCoin: string) {
    this.stableCoin = stableCoin.toUpperCase();
  }

  getFreeAsset(assetName: string): number {
    throw new Error('Method not implemented.');
  }

  getPrice(symbol: ExchangeSymbol): number {
    const query = `${CoinBase.API_URL}/prices/${symbol.quantityAsset}-USD/spot`;
    const response = execute({context: '', runnable: () => UrlFetchApp.fetch(query)})
    const data = JSON.parse(response.getContentText());
    // data format is
    // {
    //   "data": {
    //   "base": "APE",
    //     "currency": "USD",
    //     "amount": "17.089"
    // }
    return data.data.amount;
  }

  getPrices(symbols?: ExchangeSymbol[]): { [p: string]: number } {
    const response = execute({
      context: '',
      runnable: () => UrlFetchApp.fetch(CoinBase.API_URL + '/prices/USD/spot')
    })
    const data = JSON.parse(response.getContentText());
    // format is:
    // {
    //   "data": [
    //     {
    //       "base": "BTC",
    //       "currency": "USD",
    //       "amount": "9,000.00"
    //     },
    //   ]
    // }
    type Price = {
      base: string,
      currency: string,
      amount: string
    }
    return data.data.reduce((acc, ticker: Price) => {
      acc[ticker.base + this.stableCoin] = ticker.amount;
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
