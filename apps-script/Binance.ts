import {Config} from "./Store";
import {ExchangeSymbol, TradeResult} from "./TradeResult";
import {CacheProxy, FIVE_MINUTES_IN_SEC, SIX_HOURS_IN_SEC} from "./CacheProxy";
import HTTPResponse = GoogleAppsScript.URL_Fetch.HTTPResponse;
import URLFetchRequestOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;

const BLOCKED_SERVER_ = i => `BlockedBinanceServer_${i}`;

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
  private readonly numberOfAPIServers = 30; // There could be more, but 30 was verified.
  private readonly defaultReqOpts: URLFetchRequestOptions;
  private readonly tradeReqOpts: URLFetchRequestOptions;

  constructor(config: Config) {
    this.key = config.KEY
    this.secret = config.SECRET
    this.defaultReqOpts = {headers: {'X-MBX-APIKEY': this.key}, muteHttpExceptions: true}
    this.tradeReqOpts = {method: 'post', ...this.defaultReqOpts}
  }

  getPrices(): { [p: string]: number } {
    Log.info("Fetching prices")
    const response = this.fetch("ticker/price", this.defaultReqOpts);
    const prices: { symbol: string, price: string }[] = JSON.parse(response.getContentText())
    Log.debug(`Got ${prices.length} prices`)
    const map: { [p: string]: number } = {}
    prices.forEach(p => map[p.symbol] = +p.price)
    return map
  }

  getPrice(symbol: ExchangeSymbol): number {
    const resource = "ticker/price"
    const query = `symbol=${symbol}`;
    const response = this.fetch(`${resource}?${query}`, this.defaultReqOpts);
    Log.debug(response.getContentText())
    return +JSON.parse(response.getContentText()).price
  }

  getFreeAsset(assetName: string): number {
    const resource = "account"
    const query = "";
    const data = this.fetch(`${resource}?${this.addSignature(query)}`, this.defaultReqOpts);
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
    const response = this.fetch(`order?${this.addSignature(query)}`, this.tradeReqOpts)
    Log.debug(response.getContentText())
    try {
      const order = JSON.parse(response.getContentText());
      const tradeResult = new TradeResult(symbol);
      const [price, commission] = this.reducePriceAndCommission(order.fills)
      tradeResult.quantity = +order.origQty
      tradeResult.cost = +order.cummulativeQuoteQty
      tradeResult.price = price
      tradeResult.fromExchange = true
      tradeResult.commission = commission
      return tradeResult;
    } catch (e) {
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

  fetch(resource: string, options: URLFetchRequestOptions): HTTPResponse {
    return execute({
      interval: this.interval,
      attempts: this.attempts,
      runnable: () => {
        const index = this.getRandomAvailableServerIndex();
        const server = `https://api${index}.binance.com/api/v3`;
        const resp = UrlFetchApp.fetch(`${server}/${resource}`, options)

        if (resp.getResponseCode() === 200) {
          return resp;
        }

        if (resp.getResponseCode() === 418) {
          // Limit reached, mark server as blocked for 5 minutes
          CacheProxy.put(`${BLOCKED_SERVER_(index)}`, 'true', FIVE_MINUTES_IN_SEC);
        }

        if (resp.getResponseCode() === 400 && resp.getContentText().includes('Not all sent parameters were read')) {
          // Server that doesn't support some parameters, mark it as blocked for 6 hours
          CacheProxy.put(`${BLOCKED_SERVER_(index)}`, 'true', SIX_HOURS_IN_SEC);
        }

        throw new Error(`${resp.getResponseCode()} ${resp.getContentText()}`)
      }
    });
  }


  /**
   * getRandomAvailableServerIndex returns a random server number in a range `1` - `{numberOfAPIServers}`,
   * among the ones that are not blocked by the tool.
   */
  private getRandomAvailableServerIndex(): number {
    let index;
    let isBlocked = true;

    // create and shuffle an array with values from 1 to numberOfAPIServers
    const serverIds = Array
      .from(Array(this.numberOfAPIServers).keys())
      .map(i => i + 1)
      .sort(() => Math.random() - 0.5);

    const blockedServers = CacheProxy.getAll(serverIds.map(BLOCKED_SERVER_));

    while (isBlocked && serverIds.length > 0) {
      index = serverIds.pop();
      isBlocked = !!blockedServers[`${BLOCKED_SERVER_(index)}`];
    }

    if (isBlocked) {
      throw new Error(`${INTERRUPT}: All ${this.numberOfAPIServers} Binance servers are blocked.`);
    }

    return index;
  }
}
