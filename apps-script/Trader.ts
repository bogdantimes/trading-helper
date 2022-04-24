import {TradeMemo, TradeState} from "./TradeMemo";
import {IExchange} from "./Binance";
import {Statistics} from "./Statistics";
import {Config, IStore} from "./Store";
import {ExchangeSymbol} from "./TradeResult";

const PriceMemoMaxCapacity = 10;
export type PriceMemo = [number, number, number]

export class V2Trader {
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

  tickerCheck(tradeMemo: TradeMemo): void {

    if (tradeMemo.stateIs(TradeState.SELL)) {
      this.sellAndClose(tradeMemo)
    }

    const symbol = tradeMemo.tradeResult.symbol;
    const currentPrice = this.getPrice(symbol);

    tradeMemo.prices.push(currentPrice)
    // remove old prices and keep only the last PriceMemoMaxCapacity
    tradeMemo.prices.splice(0, tradeMemo.prices.length - PriceMemoMaxCapacity)
    tradeMemo.maxObservedPrice = Math.max(tradeMemo.maxObservedPrice, ...tradeMemo.prices)

    const priceGoesUp = this.priceGoesUp(tradeMemo.prices);

    if (priceGoesUp) {
      Log.info(`${symbol} price goes up`)
    }

    if (tradeMemo.stateIs(TradeState.BOUGHT)) {

      if (currentPrice <= tradeMemo.stopLossPrice) {
        const stopLimitCrossed = tradeMemo.prices[1] > tradeMemo.stopLossPrice;
        if (stopLimitCrossed) {
          Log.info(`${symbol}: crossed stop limit: price '${currentPrice}' <= '${tradeMemo.stopLossPrice}'`)
        }
        if (!tradeMemo.hodl && this.store.getConfig().SellAtStopLimit) {
          tradeMemo.setState(TradeState.SELL)
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
          tradeMemo.setState(TradeState.SELL)
        }
      }

      if (priceGoesUp) {
        // Using previous price to calculate new stop limit
        const newStopLimit = tradeMemo.prices[0] * (1 - this.config.LossLimit);
        tradeMemo.stopLossPrice = tradeMemo.stopLossPrice < newStopLimit ? newStopLimit : tradeMemo.stopLossPrice
      }

      tradeMemo.maxLoss = tradeMemo.tradeResult.paid * (tradeMemo.stopLossPrice / tradeMemo.tradeResult.price - 1)
      tradeMemo.maxProfit = (currentPrice * tradeMemo.tradeResult.quantity) - tradeMemo.tradeResult.paid
    }

    if (tradeMemo.stateIs(TradeState.SOLD) && this.config.SwingTradeEnabled) {
      // Swing trade enabled.
      // Checking if price dropped below max observed price minus take profit percentage,
      // and we can buy again
      const priceDropped = currentPrice < tradeMemo.maxObservedPrice * (1 - this.config.TakeProfit);
      if (priceDropped) {
        tradeMemo.setState(TradeState.BUY)
        Log.alert(`${symbol} will be bought again as price dropped sufficiently`)
      } else {
        Log.info(`${symbol} price has not dropped sufficiently, skipping swing trade`)
      }
    }

    this.store.setTrade(tradeMemo)

    if (tradeMemo.stateIs(TradeState.SELL)) {
      this.sellAndClose(tradeMemo)
    } else if (tradeMemo.stateIs(TradeState.BUY) && priceGoesUp) {
      this.buy(tradeMemo, this.config.BuyQuantity)
    } else {
      Log.info(`${symbol}: waiting`)
    }

  }

  private getPrice(symbol: ExchangeSymbol): number {
    const price = this.prices[symbol.toString()];
    if (!price) {
      throw Error(`No symbol price: ${symbol}`)
    }
    return price
  }

  private buy(memo: TradeMemo, cost: number): void {
    const tradeResult = this.exchange.marketBuy(memo.tradeResult.symbol, cost);
    if (tradeResult.fromExchange) {
      memo.joinWithNewTrade(tradeResult);
      memo.stopLossPrice = tradeResult.price * (1 - this.config.LossLimit);
      this.store.setTrade(memo)
    }
    Log.alert(memo.tradeResult.toString())
  }

  private sellAndClose(memo: TradeMemo): void {
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

    if (tradeResult.profit > 0) {
      memo.setState(TradeState.SOLD)
      this.store.setTrade(memo)
    } else {
      Log.alert(`No profit. Deleting memo from store: ${memo.getKey().toString()}`)
      this.store.deleteTrade(memo)
    }
  }

  private priceGoesUp(prices: PriceMemo, lastN: number = 3): boolean {
    const lastPrices = prices.slice(-lastN);
    if (lastPrices[0] == 0 || lastPrices.length < lastN) {
      return false
    }
    return lastPrices.every((p, i) => i == 0 ? true : p > lastPrices[i - 1])
  }

  private getBNBCommissionCost(commission: number): number {
    const bnbPrice = this.prices["BNB" + this.config.PriceAsset];
    return bnbPrice ? commission * bnbPrice : 0;
  }

}
