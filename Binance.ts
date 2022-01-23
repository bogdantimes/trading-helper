interface IExchange {
  getFreeAsset(assetName: string): number

  marketBuy(symbol: ExchangeSymbol, qty: number): TradeResult

  marketSell(symbol: ExchangeSymbol): TradeResult

  getPrice(symbol: ExchangeSymbol): number
}

class Binance implements IExchange {
  private static readonly API = "https://api.binance.com/api/v3";
  private readonly key: string;
  private readonly secret: string;
  private readonly tradeReqParams: object;
  private readonly reqParams: object;
  private readonly priceCache: Map<string, number>;

  constructor(store: IStore) {
    this.key = store.get('KEY')
    this.secret = store.get('SECRET')
    this.tradeReqParams = {method: 'post', headers: {'X-MBX-APIKEY': this.key}}
    this.reqParams = {headers: {'X-MBX-APIKEY': this.key}}
    this.priceCache = new Map()
  }

  getPrice(symbol: ExchangeSymbol): number {
    const resource = "ticker/price"
    const query = `symbol=${symbol}`;
    const data = execute({
      context: null, interval: 100, attempts: 100,
      runnable: ctx => UrlFetchApp.fetch(`${Binance.API}/${resource}?${query}`, this.reqParams)
    });
    Log.debug(data.getContentText())
    const price = +JSON.parse(data.getContentText()).price;
    this.priceCache.set(symbol.toString(), price)
    return price
  }

  getFreeAsset(assetName: string): number {
    const resource = "account"
    const query = "";
    const data = execute({
      context: null, interval: 100, attempts: 100,
      runnable: ctx => UrlFetchApp.fetch(`${Binance.API}/${resource}?${this.addSignature(query)}`, this.reqParams)
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

  marketBuy(symbol: ExchangeSymbol, quantity: number): TradeResult {
    const freeAsset = this.getFreeAsset(symbol.priceAsset)
    if (freeAsset < quantity) {
      return TradeResult.fromMsg(symbol, `NOT ENOUGH TO BUY: ${symbol.priceAsset}=${freeAsset}`)
    }
    const query = `symbol=${symbol}&type=MARKET&side=BUY&quoteOrderQty=${quantity}`;
    const tradeResult = this.marketTrade(query);
    tradeResult.cost *= -1
    tradeResult.symbol = symbol
    return tradeResult;
  }

  marketSell(symbol: ExchangeSymbol): TradeResult {
    const freeAsset = this.getFreeAsset(symbol.quantityAsset)
    const price = this.priceCache.get(symbol.toString()) || this.getPrice(symbol);
    const quoteQty = Math.ceil(price * freeAsset)
    if (quoteQty < 10) { // Binance order limit in USDT
      return TradeResult.fromMsg(symbol, `NOT ENOUGH TO SELL: ${symbol.quantityAsset}=${freeAsset}, ${symbol.priceAsset}=${quoteQty}`)
    }
    const query = `symbol=${symbol}&type=MARKET&side=SELL&quoteOrderQty=${quoteQty}`;
    const tradeResult = this.marketTrade(query);
    tradeResult.symbol = symbol
    return tradeResult;
  }

  marketTrade(query: string): TradeResult {
    const response = execute({
      context: null, interval: 100, attempts: 100,
      runnable: ctx => UrlFetchApp.fetch(`${Binance.API}/order?${this.addSignature(query)}`, this.tradeReqParams)
    });
    Log.debug(response.getContentText())
    try {
      const order = JSON.parse(response.getContentText());
      const tradeResult = new TradeResult();
      const price = order.fills && order.fills[0] && order.fills[0].price
      tradeResult.cost = +order.cummulativeQuoteQty
      tradeResult.price = +price
      tradeResult.fromExchange = true
      return tradeResult;
    } catch (e) {
      Log.error(e)
      throw e
    }
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
