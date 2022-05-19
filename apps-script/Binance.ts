import {Config} from "./Store";
import {ExchangeSymbol, TradeResult} from "./TradeResult";
import {IExchange, IPriceProvider} from "./Exchange";
import {PriceMap} from "./shared-lib/types";
import {CacheProxy} from "./CacheProxy";
import URLFetchRequestOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions;

export class Binance implements IExchange, IPriceProvider {

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

  getPrices(): PriceMap {
    Log.info("Fetching prices from Binance")
    try {
      const prices: { symbol: string, price: string }[] = this.fetch(() => "ticker/price", this.defaultReqOpts);
      Log.debug(`Got ${prices.length} prices`)
      return prices.reduce<PriceMap>((acc, p) => {
        const spotPrice = !p.symbol.match(/^\w+(UP|DOWN|BEAR|BULL)\w+$/);
        spotPrice && (acc[p.symbol] = +p.price)
        return acc
      }, {})
    } catch (e) {
      throw new Error(`Failed to get prices: ${e.message}`);
    }
  }

  getPrice(symbol: ExchangeSymbol): number {
    const resource = "ticker/price"
    const query = `symbol=${symbol}`;
    try {
      const ticker = this.fetch(() => `${resource}?${query}`, this.defaultReqOpts);
      Log.debug(ticker)
      return +ticker.price
    } catch (e) {
      throw new Error(`Failed to get price for ${symbol}: ${e.message}`);
    }
  }

  getFreeAsset(assetName: string): number {
    const accountDataJson = CacheProxy.get("AccountData");
    let accountData = accountDataJson ? JSON.parse(accountDataJson) : null;
    if (!accountData) {
      const resource = "account"
      const query = "";
      try {
        accountData = this.fetch(() => `${resource}?${this.addSignature(query)}`, this.defaultReqOpts);
        CacheProxy.put("AccountData", JSON.stringify(accountData), 1); // 1 second
      } catch (e) {
        throw new Error(`Failed to get available ${assetName}: ${e.message}`);
      }
    }
    const assetVal = accountData.balances.find((balance) => balance.asset == assetName);
    return assetVal ? +assetVal.free : 0
  }

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult {
    const moneyAvailable = this.getFreeAsset(symbol.priceAsset)
    if (moneyAvailable < cost) {
      return new TradeResult(symbol, `Not enough money to buy: ${symbol.priceAsset}=${moneyAvailable}`)
    }
    Log.alert(`Buying ${symbol.quantityAsset} for ${cost} ${symbol.priceAsset}`)
    const query = `symbol=${symbol}&type=MARKET&side=BUY&quoteOrderQty=${cost}`;
    try {
      const tradeResult = this.marketTrade(symbol, query);
      tradeResult.symbol = symbol
      tradeResult.paid = tradeResult.cost
      Log.alert(`Bought ${tradeResult.quantity} ${symbol.quantityAsset}. Paid: ${tradeResult.cost} ${symbol.priceAsset}. Average price: ${tradeResult.price}`)
      return tradeResult;
    } catch (e) {
      if (e.message.includes("Market is closed")) {
        return new TradeResult(symbol, `Market is closed for ${symbol}.`)
      }
      throw e;
    }
  }

  /**
   * Sells specified quantity or all available asset.
   * @param symbol
   * @param quantity
   */
  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult {
    const query = `symbol=${symbol}&type=MARKET&side=SELL&quantity=${quantity}`;
    Log.alert(`Selling ${quantity} ${symbol.quantityAsset} for ${symbol.priceAsset}`)
    try {
      const tradeResult = this.marketTrade(symbol, query);
      tradeResult.gained = tradeResult.cost
      tradeResult.soldPrice = tradeResult.price
      Log.alert(`Sold ${tradeResult.quantity} ${symbol.quantityAsset} for ${tradeResult.cost} ${symbol.priceAsset}. Average price: ${tradeResult.price}`)
      return tradeResult;
    } catch (e) {
      if (e.message.includes("Account has insufficient balance")) {
        return new TradeResult(symbol, `Account has no ${quantity} of ${symbol.quantityAsset}`)
      }
      if (e.message.includes("Market is closed")) {
        return new TradeResult(symbol, `Market is closed for ${symbol}.`)
      }
      if (e.message.includes("MIN_NOTIONAL")) {
        return new TradeResult(symbol, `The cost of ${symbol.quantityAsset} is less than minimal needed to sell it.`)
      }
      throw e
    }
  }

  marketTrade(symbol: ExchangeSymbol, query: string): TradeResult {
    try {
      const order = this.fetch(() => `order?${this.addSignature(query)}`, this.tradeReqOpts)
      Log.debug(order)
      const tradeResult = new TradeResult(symbol);
      const commission = this.getCommission(order.fills)
      tradeResult.quantity = +order.origQty
      tradeResult.cost = +order.cummulativeQuoteQty
      tradeResult.fromExchange = true
      tradeResult.commission = commission
      return tradeResult;
    } catch (e) {
      throw new Error(`Failed to trade ${symbol}: ${e.message}`);
    }
  }

  private getCommission(fills = []): number {
    let commission = 0
    fills.forEach(f => {
      if (f.commissionAsset != "BNB") {
        Log.alert(`Commission is ${f.commissionAsset} instead of BNB`)
      } else {
        commission += +f.commission
      }
    })
    return commission
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

  fetch(resource: () => string, options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions): any {
    return execute({
      interval: this.interval,
      attempts: this.attempts,
      runnable: () => {
        const index = this.getNextServerIndex();
        const server = `https://api${index}.binance.com/api/v3`;
        const resp = UrlFetchApp.fetch(`${server}/${resource()}`, options)

        if (resp.getResponseCode() === 200) {
          try {
            return JSON.parse(resp.getContentText());
          } catch (e) {
            throw new Error(`Failed to parse response from Binance: ${resp.getContentText()}`);
          }
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
