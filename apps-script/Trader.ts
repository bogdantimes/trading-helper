import {TradeMemo, TradeState} from "./TradeMemo";
import {IExchange} from "./Binance";
import {Statistics} from "./Statistics";
import {Config, IStore} from "./Store";
import {ExchangeSymbol} from "./TradeResult";
import {TradesQueue} from "./TradesQueue";

export class V2Trader {
  private readonly store: IStore;
  private readonly config: Config;
  private readonly exchange: IExchange;
  private readonly stats: Statistics;
  private readonly prices: { [p: string]: number };
  private readonly afterAll: Array<() => void> = [];

  constructor(store: IStore, exchange: IExchange, stats: Statistics) {
    this.store = store;
    this.config = store.getConfig();
    this.exchange = exchange
    this.stats = stats
    this.prices = exchange.getPrices()
  }

  /**
   * After ticker check can be executed after all tickers are checked.
   * It may contain any additional operations that need to be performed after all.
   */
  afterTickerCheck() {
    while (this.afterAll.length > 0) {
      this.afterAll.pop()();
    }
  }

  tickerCheck(tm: TradeMemo): void {
    this.pushNewPrice(tm);

    if (tm.stateIs(TradeState.BOUGHT)) {
      this.processBoughtState(tm);
    } else if (tm.stateIs(TradeState.SOLD)) {
      this.processSoldState(tm);
    }

    // save new pushed price and any intermediate state changes
    this.store.setTrade(tm)

    const priceGoesUp = tm.priceGoesUp()
    priceGoesUp && Log.info(`${tm.tradeResult.symbol} price goes up`)

    // take action after processing
    if (tm.stateIs(TradeState.SELL) && !priceGoesUp) {
      // sell if price not goes up anymore
      // this allows to wait if price continues to go up
      this.sell(tm)
    } else if (tm.stateIs(TradeState.BUY) && priceGoesUp) {
      // buy only if price started to go up
      // this allows to wait if price continues to fall
      this.buy(tm, this.config.BuyQuantity)
    }
  }

  private processSoldState(tm: TradeMemo): void {
    if (!this.config.SwingTradeEnabled) {
      return
    }
    // Swing trade enabled.
    // Checking if price dropped below max observed price minus profit limit percentage,
    // and we can buy again
    const symbol = tm.tradeResult.symbol;
    const priceDropped = tm.currentPrice < tm.maxObservedPrice * (1 - this.config.ProfitLimit);
    if (priceDropped) {
      Log.alert(`${symbol} will be bought again as price dropped sufficiently`)
      tm.setState(TradeState.BUY)
    } else {
      Log.info(`${symbol} price has not dropped sufficiently, skipping swing trade`)
    }
  }

  private processBoughtState(tm: TradeMemo): void {
    const symbol = tm.tradeResult.symbol;
    const priceGoesUp = tm.priceGoesUp()

    if (tm.profitLimitCrossedUp(this.config.ProfitLimit)) {
      Log.alert(`${symbol} crossed profit limit`)
    } else if (tm.lossLimitCrossedDown()) {
      Log.alert(`${symbol}: crossed stop limit`)
    }

    if (tm.currentPrice < tm.stopLimitPrice) {
      const canSell = !tm.hodl && this.store.getConfig().SellAtStopLimit;
      canSell && tm.setState(TradeState.SELL)
    }

    const profitLimitPrice = tm.tradeResult.price * (1 + this.config.ProfitLimit);
    if (tm.currentPrice > profitLimitPrice) {
      const canSell = !tm.hodl && this.store.getConfig().SellAtProfitLimit;
      canSell && tm.setState(TradeState.SELL)
    }

    if (priceGoesUp) {
      // Using the previous price a few measures back to calculate new stop limit
      const newStopLimit = tm.prices[tm.prices.length - 3] * (1 - this.config.StopLimit);
      tm.stopLimitPrice = Math.max(tm.stopLimitPrice, newStopLimit);
    }
  }

  private pushNewPrice(tm: TradeMemo): void {
    const symbol = tm.tradeResult.symbol;
    const price = this.prices[symbol.toString()];
    if (price) {
      tm.pushPrice(price)
    } else if (tm.tradeResult.quantity) {
      // no price available, but we have quantity, which means we bought something earlier
      throw Error(`Exchange does not have price for ${symbol}`)
    } else {
      // no price available, and no quantity, which means we haven't bought anything yet
      // could be a non-existing symbol, or not yet published in the exchange
      Log.info(`Exchange does not have price for ${symbol}`)
    }
  }

  private buy(memo: TradeMemo, cost: number): void {
    const symbol = memo.tradeResult.symbol;
    const tradeResult = this.exchange.marketBuy(symbol, cost);
    if (tradeResult.fromExchange) {
      Log.debug(memo);
      memo.joinWithNewTrade(tradeResult);
      memo.stopLimitPrice = tradeResult.price * (1 - this.config.StopLimit);
      this.store.setTrade(memo)
      Log.alert(memo.tradeResult.toString())
    } else {
      Log.alert(tradeResult.toString())
      TradesQueue.cancelAction(symbol.quantityAsset);
    }
  }

  private sell(memo: TradeMemo): void {
    const symbol = memo.tradeResult.symbol;
    const tradeResult = this.exchange.marketSell(symbol, memo.tradeResult.quantity);
    const gained = tradeResult.gained;
    if (tradeResult.fromExchange) {
      Log.debug(memo);
      const buyCommission = this.getBNBCommissionCost(memo.tradeResult.commission);
      const sellCommission = this.getBNBCommissionCost(tradeResult.commission);
      Log.info(`Commission: ~${buyCommission + sellCommission}`)
      const profit = gained - memo.tradeResult.paid - sellCommission - buyCommission;
      tradeResult.profit = +profit.toFixed(2);
      memo.tradeResult = tradeResult;
      memo.setState(TradeState.SOLD)
      this.stats.addProfit(tradeResult.profit)
    } else {
      memo.hodl = true;
      memo.setState(TradeState.BOUGHT);
      Log.alert(`An issue happened while selling ${symbol}. The asset is marked HODL. Please, resolve it manually.`)
    }

    this.store.setTrade(memo)
    Log.alert(tradeResult.toString());

    if (memo.stateIs(TradeState.SOLD) && this.config.AveragingDown) {
      this.afterAll.push(() => {
        // all gains are reinvested to most unprofitable asset
        // find a trade with the lowest profit percentage
        const byProfitPercentDesc = (t1, t2) => t1.profitPercent() < t2.profitPercent() ? -1 : 1;
        const lowestProfitTrade = this.store.getTradesList()
          .filter(t => t.stateIs(TradeState.BOUGHT))
          .sort(byProfitPercentDesc)[0];
        if (lowestProfitTrade) {
          Log.alert('Averaging down is enabled')
          Log.alert(`All gains from selling ${symbol} are being invested to ${lowestProfitTrade.tradeResult.symbol}`);
          this.buy(lowestProfitTrade, gained);
        }
      })
    }
  }

  private getBNBCommissionCost(commission: number): number {
    const bnbPrice = this.prices["BNB" + this.config.PriceAsset];
    return bnbPrice ? commission * bnbPrice : 0;
  }
}
