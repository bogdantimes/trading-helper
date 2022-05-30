import { IPriceProvider } from "./Exchange"
import { execute, Log } from "./Common"
import { PriceMap } from "trading-helper-lib"

export class CoinStats implements IPriceProvider {
  private static readonly API_URL = `https://api.coinstats.app/public/v1`

  getPrices(): PriceMap {
    Log.info(`Fetching prices from CoinStats`)
    try {
      const tickers = execute({
        runnable: () => UrlFetchApp.fetch(CoinStats.API_URL + `/tickers?exchange=binance`),
      })
      const data = JSON.parse(tickers.getContentText())
      Log.debug(`Got ${data.tickers.length} prices`)
      return data.tickers.reduce((acc: PriceMap, ticker) => {
        acc[ticker.from + ticker.to] = ticker.price
        return acc
      }, {})
    } catch (e) {
      throw new Error(`Failed to get tickers from CoinStats: ${e.message}`)
    }
  }
}
