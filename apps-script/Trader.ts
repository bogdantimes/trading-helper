import {TradeMemo, TradeState} from "./TradeMemo";
import {IExchange} from "./Binance";
import {Statistics} from "./Statistics";
import {Config, IStore} from "./Store";
import {ExchangeSymbol} from "./TradeResult";

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
      return this.sellAndClose(tradeMemo)
    }

    const symbol = tradeMemo.tradeResult.symbol;
    const currentPrice = this.getPrice(symbol);
    tradeMemo.pushPrice(currentPrice)

    const priceGoesUp = this.priceGoesUp(tradeMemo.prices);

    if (priceGoesUp) {
      Log.info(`${symbol} price goes up`)
    }

    if (tradeMemo.stateIs(TradeState.BOUGHT)) {

      if (tradeMemo.profitLimitCrossedUp(this.config.TakeProfit)) {
        Log.alert(`${symbol} crossed profit limit`)
      } else if (tradeMemo.lossLimitCrossedDown()) {
        Log.alert(`${symbol}: crossed loss limit`)
      }

      if (currentPrice < tradeMemo.stopLimitPrice) {
        const canSell = !tradeMemo.hodl && this.store.getConfig().SellAtStopLimit;
        canSell && tradeMemo.setState(TradeState.SELL)
      }

      const profitLimitPrice = tradeMemo.tradeResult.price * (1 + this.config.TakeProfit);
      if (currentPrice > profitLimitPrice) {
        const canSell = !tradeMemo.hodl && this.store.getConfig().SellAtTakeProfit;
        canSell && !priceGoesUp && tradeMemo.setState(TradeState.SELL)
      }

      if (priceGoesUp) {
        // Using previous price two measures back to calculate new stop limit
        const newStopLimit = tradeMemo.prices[tradeMemo.prices.length - 3] * (1 - this.config.LossLimit);
        tradeMemo.stopLimitPrice = tradeMemo.stopLimitPrice < newStopLimit ? newStopLimit : tradeMemo.stopLimitPrice
      }
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
      Log.debug(memo);
      memo.joinWithNewTrade(tradeResult);
      memo.stopLimitPrice = tradeResult.price * (1 - this.config.LossLimit);
      this.store.setTrade(memo)
    }
    Log.alert(memo.tradeResult.toString())
  }

  private sellAndClose(memo: TradeMemo): void {
    const tradeResult = this.exchange.marketSell(memo.tradeResult.symbol, memo.tradeResult.quantity);

    if (tradeResult.fromExchange) {
      Log.debug(memo);
      const buyCommission = this.getBNBCommissionCost(memo.tradeResult.commission);
      const sellCommission = this.getBNBCommissionCost(tradeResult.commission);
      Log.info(`Commission: ~${buyCommission + sellCommission}`)
      const profit = tradeResult.gained - memo.tradeResult.paid - sellCommission - buyCommission;
      tradeResult.profit = +profit.toFixed(2);
      memo.tradeResult = tradeResult;
      memo.setState(TradeState.SOLD)
      this.stats.addProfit(tradeResult.profit)
    } else {
      memo.hodl = true;
      memo.setState(TradeState.BOUGHT);
      Log.alert(`An issue happened while selling ${memo.tradeResult.symbol}. The asset is marked HODL. Please, resolve it manually.`)
    }

    this.store.setTrade(memo)
    Log.alert(tradeResult.toString());

    if (memo.stateIs(TradeState.SOLD) && this.config.AveragingDown) {
      // all gains are reinvested to most unprofitable asset
      // find a trade with the lowest profit percentage
      const byProfitPercentDesc = (t1, t2) => t1.profitPercent() < t2.profitPercent() ? -1 : 1;
      const lowestProfitTrade = this.store.getTradesList()
        .filter(t => t.stateIs(TradeState.BOUGHT))
        .sort(byProfitPercentDesc)[0];
      if (lowestProfitTrade) {
        Log.alert('Averaging down is enabled')
        Log.alert(`All gains from selling ${memo.tradeResult.symbol} are being invested to ${lowestProfitTrade.tradeResult.symbol}`);
        this.buy(lowestProfitTrade, tradeResult.gained);
      }
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
