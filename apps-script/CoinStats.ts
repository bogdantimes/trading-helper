import {IPriceProvider} from "./Exchange";

export class CoinStats implements IPriceProvider {

  private static readonly API_URL = 'https://api.coinstats.app/public/v1';

  getPrices(): { [p: string]: number } {
    Log.info("Fetching prices from CoinStats");
    const tickers = execute({
      runnable: () => UrlFetchApp.fetch(CoinStats.API_URL + '/tickers?exchange=binance')
    })
    try {
      const data = JSON.parse(tickers.getContentText());
      Log.debug(`Got ${data.tickers.length} prices`)
      return data.tickers.reduce((acc, ticker) => {
        acc[ticker.from + ticker.to] = ticker.price;
        return acc;
      }, {});
    } catch (e) {
      Log.error(new Error(`Failed to get tickers from CoinStats: ${tickers.getContentText()}`));
      return {};
    }
  }

}
