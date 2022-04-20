import {TradeMemo} from "./TradeMemo";
import {IExchange} from "./Binance";
import {Statistics} from "./Statistics";
import {Config, IStore} from "./Store";

export type PriceMemo = [number, number, number]

export class V2Trader implements Trader {
  private readonly store: IStore;
  private readonly config: Config;
  private readonly exchange: IExchange;
  private readonly stats: Statistics;
  private readonly prices: { [p: string]: number };

  constructor(store: IStore, exchange: IExchange, stats: Statistics) {
    this.store = store;
    this.config = store.getConfig();
    this.exchange = exchange
    this.stats = stats
    this.prices = exchange.getPrices()
  }

  buy(symbol: ExchangeSymbol, cost: number): TradeResult {

    let trade = this.exchange.marketBuy(symbol, cost);

    if (trade.fromExchange) {
      const memo: TradeMemo = this.store.getTrade(symbol);
      if (memo && memo.tradeResult.fromExchange) {
        trade = memo.tradeResult.join(trade);
      }
      Log.alert(trade.toString())
      const stopLossPrice = trade.price * (1 - this.config.LossLimit);
      const prices: PriceMemo = memo ? memo.prices : [trade.price, trade.price, trade.price];
      this.store.setTrade(new TradeMemo(trade, stopLossPrice, prices))
    }

    return trade
  }

  sell(symbol: ExchangeSymbol): TradeResult {
    const tradeMemo: TradeMemo = this.store.getTrade(symbol);
    if (tradeMemo) {
      tradeMemo.sell = true;
      this.store.setTrade(tradeMemo)
      return this.sellAndClose(tradeMemo)
    }
    return TradeResult.fromMsg(symbol, "Asset is not present")
  }

  tickerCheck(tradeMemo: TradeMemo): TradeResult {
    const symbol = tradeMemo.tradeResult.symbol;

    if (tradeMemo.sell) {
      return this.sellAndClose(tradeMemo)
    }

    if (tradeMemo.sold && !this.config.SwingTradeEnabled) {
      return TradeResult.fromMsg(symbol, "Asset is sold");
    }

    const currentPrice = this.getPrice(symbol);

    if (tradeMemo.sold) {
      // Swing trade enabled.
      // Checking if price dropped below max observed price minus take profit percentage,
      // and we can buy again
      const priceDropped = currentPrice < tradeMemo.maxObservedPrice * (1 - this.config.TakeProfit);
      if (!priceDropped) {
        return TradeResult.fromMsg(symbol, "Price has not dropped sufficiently. Waiting...")
      }
      tradeMemo.buy = true;
      Log.alert(`${symbol} will be bought again as price dropped sufficiently`)
    }

    tradeMemo.prices.shift()
    tradeMemo.prices.push(currentPrice)
    tradeMemo.maxObservedPrice = Math.max(...tradeMemo.prices)
    this.store.setTrade(tradeMemo)

    const priceGoesUp = this.priceGoesUp(tradeMemo.prices);
    // Checking if it is marked to buy it (either a new asset or buying more for existing one).
    if (tradeMemo.buy) {
      if (priceGoesUp) {
        return this.buy(symbol, this.config.BuyQuantity)
      }
      return TradeResult.fromMsg(symbol, "Not buying yet. Price is not going up")
    }

    if (currentPrice <= tradeMemo.stopLossPrice) {
      const stopLimitCrossed = tradeMemo.prices[1] > tradeMemo.stopLossPrice;
      if (stopLimitCrossed) {
        Log.info(`${symbol}: crossed stop limit: price '${currentPrice}' <= '${tradeMemo.stopLossPrice}'`)
      }
      if (!tradeMemo.hodl && this.store.getConfig().SellAtStopLimit) {
        return this.sellAndClose(tradeMemo)
      }
    }

    const takeProfitPrice = tradeMemo.tradeResult.price * (1 + this.config.TakeProfit);
    if (currentPrice >= takeProfitPrice) {
      const takeProfitCrossed = tradeMemo.prices[1] < takeProfitPrice;
      if (takeProfitCrossed) {
        Log.alert(`${symbol} crossed take profit: price '${currentPrice}' >= '${takeProfitPrice}'`)
      }
      // We do not sell if price goes up, or we are in hodl mode, or if taking profit is disabled
      if (!priceGoesUp && !tradeMemo.hodl && this.store.getConfig().SellAtTakeProfit) {
        return this.sellAndClose(tradeMemo)
      }
    }

    if (priceGoesUp) {
      Log.info(`${symbol} price goes up`)
      // Using previous price to calculate new stop limit
      const newStopLimit = tradeMemo.prices[0] * (1 - this.config.LossLimit);
      tradeMemo.stopLossPrice = tradeMemo.stopLossPrice < newStopLimit ? newStopLimit : tradeMemo.stopLossPrice
    }

    tradeMemo.maxLoss = tradeMemo.tradeResult.paid * (tradeMemo.stopLossPrice / tradeMemo.tradeResult.price - 1)
    tradeMemo.maxProfit = (currentPrice * tradeMemo.tradeResult.quantity) - tradeMemo.tradeResult.paid
    this.store.setTrade(tradeMemo)

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

  private sellAndClose(memo: TradeMemo) {
    const tradeResult = this.exchange.marketSell(memo.tradeResult.symbol, memo.tradeResult.quantity);

    if (tradeResult.fromExchange) {
      const buyCommission = this.getBNBCommissionCost(memo.tradeResult.commission);
      const sellCommission = this.getBNBCommissionCost(tradeResult.commission);
      Log.info(`Commission: ~${buyCommission + sellCommission}`)
      const profit = tradeResult.gained - memo.tradeResult.paid - sellCommission - buyCommission;
      tradeResult.profit = +profit.toFixed(2);
      Log.alert(tradeResult.toString());
      this.stats.addProfit(tradeResult.profit)
    }

    if (this.config.SwingTradeEnabled && tradeResult.profit > 0) {
      this.store.setTrade(TradeMemo.memoToWait(tradeResult.symbol))
    } else {
      Log.alert(`Swing trade disabled, or no profit. Deleting memo from store: ${memo.getKey().toString()}`)
      this.store.deleteTrade(memo)
    }

    return tradeResult
  }

  private priceGoesUp(lastPrices: PriceMemo): boolean {
    if (lastPrices[0] == 0) {
      return false
    }
    return lastPrices.every((value, index) => index == 0 ? true : value > lastPrices[index - 1])
  }

  private getBNBCommissionCost(commission: number): number {
    const bnbPrice = this.prices["BNB" + this.config.PriceAsset];
    return bnbPrice ? commission * bnbPrice : 0;
  }

}
