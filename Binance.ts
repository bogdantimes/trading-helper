interface IExchange {
  getFreeAsset(asset: string): string

  marketBuy(assetName: string, moneyCoin: string, qty: string): TradeResult

  marketSell(assetName: string, moneyCoin: string): TradeResult
}

class Binance implements IExchange {
  private static readonly API = "https://api.binance.com/api/v3";
  private readonly key: string;
  private readonly secret: string;
  private readonly tradeReqParams: object;
  private readonly reqParams: object;

  constructor(store: IStore) {
    this.key = store.get('KEY')
    this.secret = store.get('SECRET')
    this.tradeReqParams = {method: 'post', headers: {'X-MBX-APIKEY': this.key}}
    this.reqParams = {headers: {'X-MBX-APIKEY': this.key}}
  }

  getFreeAsset(asset: string): string {
    const resource = "account"
    const query = "";
    const data = execute({
      context: null, interval: 200, attempts: 50,
      runnable: ctx => UrlFetchApp.fetch(`${Binance.API}/${resource}?${this.addSignature(query)}`, this.reqParams)
    });
    try {
      const account = JSON.parse(data.getContentText());
      const assetVal = account.balances.find((balance) => balance.asset == asset);
      Log.debug(assetVal)
      return assetVal ? assetVal.free : ""
    } catch (e) {
      Log.error(e)
    }
    return ""
  }

  marketBuy(assetName: string, moneyCoin: string, qty: string): TradeResult {
    const freeAsset = this.getFreeAsset(moneyCoin)
    if (!freeAsset || (+freeAsset < +qty)) {
      return TradeResult.fromMsg(assetName, moneyCoin, `NOT ENOUGH TO BUY: ${moneyCoin}=${freeAsset}`)
    }
    const query = `symbol=${assetName}${moneyCoin}&type=MARKET&side=BUY&quoteOrderQty=${qty}`;
    return this.marketTrade(query)
  }

  marketSell(assetName: string, moneyCoin: string): TradeResult {
    const freeAsset = this.getFreeAsset(assetName)
    if (!freeAsset || (+freeAsset < 1)) {
      return TradeResult.fromMsg(assetName, moneyCoin, `NOT ENOUGH TO SELL: ${assetName}=${freeAsset}`)
    }
    const query = `symbol=${assetName}${moneyCoin}&type=MARKET&side=SELL&quantity=${freeAsset}`;
    return this.marketTrade(query)
  }

  marketTrade(query: string) {
    const response = execute({
      context: null, interval: 200, attempts: 50,
      runnable: ctx => UrlFetchApp.fetch(`${Binance.API}/order?${this.addSignature(query)}`, this.tradeReqParams)
    });
    Log.debug(response.getContentText())
    try {
      return JSON.parse(response.getContentText())
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
