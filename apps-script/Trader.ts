import {TradeMemo, TradeMemoKey} from "./TradeMemo";
import {DefaultStore, IStore} from "./Store";
import {IExchange} from "./Binance";
import {Statistics} from "./Statistics";

export type PriceMemo = [number, number, number]

export class V2Trader implements Trader {
  private readonly store: IStore;
  private readonly exchange: IExchange;
  private readonly lossLimit: number;
  private readonly stats: Statistics;
  private readonly takeProfit: number;
  private readonly prices: { [p: string]: number };

  constructor(store: IStore, exchange: IExchange, stats: Statistics) {
    this.lossLimit = +store.getOrSet("LossLimit", "0.05") // default: 5%
    this.takeProfit = +store.getOrSet("TakeProfit", "0.2") // default: 20%
    this.store = store
    this.exchange = exchange
    this.stats = stats
    this.prices = exchange.getPrices()
  }

  buy(symbol: ExchangeSymbol, cost: number): TradeResult {

    let tradeResult = this.exchange.marketBuy(symbol, cost);

    if (tradeResult.fromExchange) {
      Log.alert(tradeResult.toString())
      const tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
      tradeResult = tradeMemo ? tradeMemo.tradeResult.join(tradeResult) : tradeResult
      const stopLossPrice = tradeResult.price * (1 - this.lossLimit);
      const prices: PriceMemo = tradeMemo ? tradeMemo.prices : [tradeResult.price, tradeResult.price, tradeResult.price]
      this.saveTradeMemo(new TradeMemo(tradeResult, stopLossPrice, prices))
      Log.info(`${symbol} stopLossPrice saved: ${stopLossPrice}`)
    }

    return tradeResult
  }

  sell(symbol: ExchangeSymbol): TradeResult {
    const tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
    if (tradeMemo) {
      this.store.set(`${tradeMemo.getKey().toString()}/sell`, true)
      return this.sellAndClose(symbol, tradeMemo)
    }
    return TradeResult.fromMsg(symbol, "Asset is not present")
  }

  stopLossSell(symbol: ExchangeSymbol): TradeResult {

    const tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    if (tradeMemo.sell) {
      return this.sellAndClose(symbol, tradeMemo)
    }

    const currentPrice = this.getPrice(symbol);

    if (currentPrice <= tradeMemo.stopLossPrice) {
      const stopLimitCrossed = tradeMemo.prices[2] > tradeMemo.stopLossPrice;
      if (stopLimitCrossed) {
        Log.alert(`Stop limit crossed: ${symbol} price '${currentPrice}' <= '${tradeMemo.stopLossPrice}'`)
      }
      if (!tradeMemo.hodl && DefaultStore.get("SellAtStopLimit")) {
        return this.sellAndClose(symbol, tradeMemo)
      }
    }

    const takeProfitPrice = tradeMemo.tradeResult.price * (1 + this.takeProfit)
    if (currentPrice >= takeProfitPrice) {
      const takeProfitCrossed = tradeMemo.prices[2] < takeProfitPrice;
      if (takeProfitCrossed) {
        Log.alert(`Take profit crossed: ${symbol} price '${currentPrice}' >= '${takeProfitPrice}'`)
      }
      if (!tradeMemo.hodl && DefaultStore.get("SellAtTakeProfit")) {
        return this.sellAndClose(symbol, tradeMemo)
      }
    }

    tradeMemo.prices.shift()
    tradeMemo.prices.push(currentPrice)

    if (this.priceGoesUp(tradeMemo.prices)) {
      Log.info(`${symbol} price goes up`)
      // Using previous price to calculate new stop limit
      const newStopLimit = tradeMemo.prices[0] * (1 - this.lossLimit);
      tradeMemo.stopLossPrice = tradeMemo.stopLossPrice < newStopLimit ? newStopLimit : tradeMemo.stopLossPrice
    }

    tradeMemo.maxLoss = tradeMemo.tradeResult.paid * (tradeMemo.stopLossPrice / tradeMemo.tradeResult.price - 1)
    tradeMemo.maxProfit = (currentPrice * tradeMemo.tradeResult.quantity) - tradeMemo.tradeResult.paid
    this.saveTradeMemo(tradeMemo)

    Log.info(`${symbol} asset kept. Stop loss price: '${tradeMemo.stopLossPrice}'`)

    return TradeResult.fromMsg(symbol, "Keeping the asset.")
  }

  private getPrice(symbol: ExchangeSymbol): number {
    const price = this.prices[symbol.toString()];
    if (!price) {
      throw Error(`No symbol price: ${symbol}`)
    }
    Log.info(`Symbol price: ${symbol} = ${price}`)
    return price
  }

  private sellAndClose(symbol: ExchangeSymbol, memo: TradeMemo) {
    const tradeResult = this.exchange.marketSell(symbol, memo.tradeResult.quantity);

    if (tradeResult.fromExchange) {
      tradeResult.profit = tradeResult.gained - memo.tradeResult.paid
      Log.alert(tradeResult.toString())
      this.stats.addProfit(tradeResult.profit)
      this.stats.addCommission(tradeResult.commission)
    }

    Log.debug(`Deleting memo from store: ${memo.getKey().toString()}`)
    this.store.delete(memo.getKey().toString())

    return tradeResult
  }

  private readTradeMemo(key: TradeMemoKey): TradeMemo {
    const tradeMemoRaw = this.store.get(key.toString());
    if (tradeMemoRaw) {
      return TradeMemo.fromObject(tradeMemoRaw)
    }
    return null
  }

  private saveTradeMemo(tradeMemo: TradeMemo) {
    this.store.set(tradeMemo.getKey().toString(), tradeMemo)
  }

  private priceGoesUp(lastPrices: PriceMemo): boolean {
    return lastPrices.every((value, index) => index == 0 ? true : value > lastPrices[index - 1])
  }

}
