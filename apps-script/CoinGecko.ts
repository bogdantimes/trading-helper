import {IExchange} from "./Binance";
import {ExchangeSymbol, TradeResult} from "./TradeResult";
import {CacheProxy} from "./CacheProxy";

type Coin = {
  id: string,
  symbol: string,
  name: string
}

type Ticker = {
  base: string,
  target: string,
  last: number
}

export class CoinGecko implements IExchange {

  private static readonly API_URL = 'https://api.coingecko.com/api/v3';
  private readonly exchange: string;
  private readonly stableCoin: string;

  constructor(stableCoin: string, exchange: string) {
    this.stableCoin = stableCoin.toUpperCase();
    this.exchange = exchange.toLowerCase();
  }

  getFreeAsset(assetName: string): number {
    throw new Error('Method not implemented.');
  }

  getPrice(symbol: ExchangeSymbol): number {
    const coinsList = this.getCoins();
    const coin = coinsList.find(c => c.symbol.toUpperCase() === symbol.quantityAsset);
    const coinIds = coin ? [coin.id] : [];
    const response = execute({
      context: '',
      runnable: () => UrlFetchApp.fetch(`${CoinGecko.API_URL}/exchanges/binance/tickers?coin_ids=${coinIds.join(',')}`)
    })
    const data = JSON.parse(response.getContentText());
    return data.tickers.find(t => t.target === this.stableCoin).last;
  }

  getCoins(): Coin[] {
    let coinGeckoCoins = CacheProxy.get('CoinGeckoCoins');
    if (!coinGeckoCoins) {
      const response = execute({
        context: '',
        runnable: () => UrlFetchApp.fetch(CoinGecko.API_URL + '/coins/list')
      })
      coinGeckoCoins = response.getContentText();
      CacheProxy.put('CoinGeckoCoins', coinGeckoCoins, 21600); // 6 hours
    }
    return JSON.parse(coinGeckoCoins);
  }

  getPrices(symbols?: ExchangeSymbol[]): { [p: string]: number } {
    const coinsList = this.getCoins();
    const coinIds = symbols ? symbols.map(s => {
      const name = s.quantityAsset;
      const coin = coinsList.find(c => c.symbol.toUpperCase() === name);
      return coin ? coin.id : name;
    }) : [];
    const response = execute({
      context: '',
      runnable: () => UrlFetchApp.fetch(`${CoinGecko.API_URL}/exchanges/binance/tickers?coin_ids=${coinIds.join(',')}`)
    })
    const data = JSON.parse(response.getContentText());
    return data.tickers.filter(t => t.target === this.stableCoin).reduce((acc, ticker: Ticker) => {
      acc[ticker.base + ticker.target] = ticker.last;
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
