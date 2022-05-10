import {Config} from "./Store";
import {ExchangeSymbol, TradeResult} from "./TradeResult";
import URLFetchRequestOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;

export interface IExchange {
  getFreeAsset(assetName: string): number

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult

  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult

  getPrice(symbol: ExchangeSymbol): number

  getPrices(): { [p: string]: number }
}

export class Binance implements IExchange {

  private readonly key: string;
  private readonly secret: string;
  private readonly attempts: number = 5;
  private readonly interval: number = 100;
  private readonly numberOfAPIServers = 5; // 5 distinct addresses were verified.
  private readonly defaultReqOpts: URLFetchRequestOptions;
  private readonly tradeReqOpts: URLFetchRequestOptions;
  private readonly serverIds: number[];

  constructor(config: Config) {
    this.key = config.KEY
    this.secret = config.SECRET
    this.defaultReqOpts = {headers: {'X-MBX-APIKEY': this.key}, muteHttpExceptions: true}
    this.tradeReqOpts = {method: 'post', ...this.defaultReqOpts}
    this.serverIds = this.shuffleServerIds();
  }

  getPrices(): { [p: string]: number } {
    Log.info("Fetching prices")
    const response = this.fetch(() => "ticker/price", this.defaultReqOpts);
    const prices: { symbol: string, price: string }[] = JSON.parse(response.getContentText())
    Log.debug(`Got ${prices.length} prices`)
    const map: { [p: string]: number } = {}
    prices.forEach(p => map[p.symbol] = +p.price)
    return map
  }

  getPrice(symbol: ExchangeSymbol): number {
    const resource = "ticker/price"
    const query = `symbol=${symbol}`;
    const response = this.fetch(() => `${resource}?${query}`, this.defaultReqOpts);
    Log.debug(response.getContentText())
    return +JSON.parse(response.getContentText()).price
  }

  getFreeAsset(assetName: string): number {
    const resource = "account"
    const query = "";
    const data = this.fetch(() => `${resource}?${this.addSignature(query)}`, this.defaultReqOpts);
    try {
      const account = JSON.parse(data.getContentText());
      const assetVal = account.balances.find((balance) => balance.asset == assetName);
      Log.debug(assetVal)
      return assetVal ? +assetVal.free : 0
    } catch (e) {
      Log.error(e)
    }
    return 0
  }

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult {
    const moneyAvailable = this.getFreeAsset(symbol.priceAsset)
    if (moneyAvailable < cost) {
      return new TradeResult(symbol, `Not enough money to buy: ${symbol.priceAsset}=${moneyAvailable}`)
    }
    Log.alert(`Buying ${symbol} for ${cost} ${symbol.priceAsset}`)
    const query = `symbol=${symbol}&type=MARKET&side=BUY&quoteOrderQty=${cost}`;
    const tradeResult = this.marketTrade(symbol, query);
    tradeResult.symbol = symbol
    tradeResult.paid = tradeResult.cost
    tradeResult.msg = "Bought."
    return tradeResult;
  }

  /**
   * Sells specified quantity or all available asset.
   * @param symbol
   * @param quantity
   */
  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult {
    const query = `symbol=${symbol}&type=MARKET&side=SELL&quantity=${quantity}`;
    Log.alert(`Selling ${quantity} of ${symbol}`);
    try {
      const tradeResult = this.marketTrade(symbol, query);
      tradeResult.gained = tradeResult.cost
      tradeResult.msg = "Sold."
      return tradeResult;
    } catch (e) {
      if (e.message.includes("Account has insufficient balance")) {
        return new TradeResult(symbol, `Account has insufficient balance for ${symbol.quantityAsset}`)
      }
      throw e
    }
  }

  marketTrade(symbol: ExchangeSymbol, query: string): TradeResult {
    const response = this.fetch(() => `order?${this.addSignature(query)}`, this.tradeReqOpts)
    try {
      const order = JSON.parse(response.getContentText());
      Log.debug(order)
      const tradeResult = new TradeResult(symbol);
      const [price, commission] = this.reducePriceAndCommission(order.fills)
      tradeResult.quantity = +order.origQty
      tradeResult.cost = +order.cummulativeQuoteQty
      tradeResult.price = price
      tradeResult.fromExchange = true
      tradeResult.commission = commission
      return tradeResult;
    } catch (e) {
      Log.debug(response.getContentText())
      Log.error(e)
      throw e
    }
  }

  private reducePriceAndCommission(fills = []): [number, number] {
    let price = 0;
    let commission = 0
    fills.forEach(f => {
      if (f.commissionAsset != "BNB") {
        Log.alert(`Commission is ${f.commissionAsset} instead of BNB`)
      } else {
        commission += +f.commission
      }
      price = price ? (+f.price + price) / 2 : +f.price;
    })
    return [price, commission]
  }

  private addSignature(data: string) {
    const timestamp = Number(new Date().getTime()).toFixed(0);
    const sigData = `${data}${data ? "&" : ""}timestamp=${timestamp}`
    const sig = Utilities.computeHmacSha256Signature(sigData, this.secret).map(e => {
      const v = (e < 0 ? e + 256 : e).toString(16);
      return v.length == 1 ? "0" + v : v;
    }).join("")

    return `${sigData}&signature=${sig}`
  }

  fetch(resource: () => string, options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions): GoogleAppsScript.URL_Fetch.HTTPResponse {
    return execute({
      interval: this.interval,
      attempts: this.attempts,
      runnable: () => {
        const index = this.getNextServerIndex();
        const server = `https://api${index}.binance.com/api/v3`;
        const resp = UrlFetchApp.fetch(`${server}/${resource()}`, options)

        if (resp.getResponseCode() === 200) {
          return resp;
        }

        if (resp.getResponseCode() === 418) {
          // Limit reached
          Log.debug("Got 418 response code from " + server)
        }

        if (resp.getResponseCode() === 400 && resp.getContentText().includes('Not all sent parameters were read')) {
          // Likely a request signature verification timeout
          Log.debug("Got 400 response code from " + server)
        }

        throw new Error(`${resp.getResponseCode()} ${resp.getContentText()}`)
      }
    });
  }

  private shuffleServerIds() {
    return Array
      .from(Array(this.numberOfAPIServers).keys())
      .map(i => i + 1)
      .sort(() => Math.random() - 0.5)
  }

  private getNextServerIndex(): number {
    // take first server from the list and move it to the end
    const index = this.serverIds.shift();
    this.serverIds.push(index);
    return index;
  }
}
