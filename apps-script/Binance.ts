import {Config} from "./Store";
import {ExchangeSymbol, TradeResult} from "./TradeResult";

export interface IExchange {
  getFreeAsset(assetName: string): number

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult

  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult

  getPrice(symbol: ExchangeSymbol): number

  getPrices(): { [p: string]: number }
}

const ATTEMPTS = 20;
const INTERVAL = 100;

export class Binance implements IExchange {
  private static readonly API = () => {
    return getRandomFromList([
      "https://api1.binance.com/api/v3",
      "https://api2.binance.com/api/v3",
      "https://api3.binance.com/api/v3",
    ]);
  }
  private readonly key: string;
  private readonly secret: string;
  private readonly tradeReqParams: object;
  private readonly reqParams: object;

  constructor(config: Config) {
    this.key = config.KEY
    this.secret = config.SECRET
    this.tradeReqParams = {method: 'post', headers: {'X-MBX-APIKEY': this.key}}
    this.reqParams = {headers: {'X-MBX-APIKEY': this.key}}
  }

  getPrices(): { [p: string]: number } {
    Log.info("Fetching prices")
    const resource = "ticker/price"
    const data = execute({
      context: '', interval: 1000, attempts: 2,
      runnable: () => UrlFetchApp.fetch(`${Binance.API()}/${resource}`, this.reqParams)
    });
    const prices: { symbol: string, price: string }[] = JSON.parse(data.getContentText())
    Log.debug(`Got ${prices.length} prices`)
    const map: { [p: string]: number } = {}
    prices.forEach(p => map[p.symbol] = +p.price)
    return map
  }

  getPrice(symbol: ExchangeSymbol): number {
    const resource = "ticker/price"
    const query = `symbol=${symbol}`;
    const data = execute({
      context: '', interval: 1000, attempts: 2,
      runnable: () => UrlFetchApp.fetch(`${Binance.API()}/${resource}?${query}`, this.reqParams)
    });
    Log.debug(data.getContentText())
    return +JSON.parse(data.getContentText()).price
  }

  getFreeAsset(assetName: string): number {
    const resource = "account"
    const query = "";
    const data = execute({
      context: '', interval: INTERVAL, attempts: ATTEMPTS,
      runnable: () => UrlFetchApp.fetch(`${Binance.API()}/${resource}?${this.addSignature(query)}`, this.reqParams)
    });
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
    Log.alert(`Buying ${symbol}`);
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
    Log.alert(`Selling ${symbol}`);
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
    const response = execute({
      context: '', interval: INTERVAL, attempts: ATTEMPTS,
      runnable: () => UrlFetchApp.fetch(`${Binance.API()}/order?${this.addSignature(query)}`, this.tradeReqParams)
    });
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
        Log.info(`Commission is ${f.commissionAsset} instead of BNB`)
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
}
