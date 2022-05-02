import {TradeMemo, TradeState} from "./TradeMemo";
import {IExchange} from "./Binance";
import {Statistics} from "./Statistics";
import {Config, IStore} from "./Store";
import {ExchangeSymbol} from "./TradeResult";

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

  tickerCheck(tradeMemo: TradeMemo): void {

    if (tradeMemo.stateIs(TradeState.SELL)) {
      return this.sellAndClose(tradeMemo)
    }

    const symbol = tradeMemo.tradeResult.symbol;
    tradeMemo.pushPrice(this.getPrice(symbol))

    const priceGoesUp = tradeMemo.priceGoesUp()
    priceGoesUp && Log.info(`${symbol} price goes up`)

    if (tradeMemo.stateIs(TradeState.BOUGHT)) {
      this.processBoughtState(tradeMemo);
    } else if (tradeMemo.stateIs(TradeState.SOLD)) {
      this.processSoldState(tradeMemo);
    }

    // save new pushed price and any intermediate state changes
    this.store.setTrade(tradeMemo)

    // take action after processing
    if (tradeMemo.stateIs(TradeState.SELL)) {
      this.sellAndClose(tradeMemo)
    } else if (tradeMemo.stateIs(TradeState.BUY) && priceGoesUp) {
      this.buy(tradeMemo, this.config.BuyQuantity)
    } else {
      Log.info(`${symbol}: waiting`)
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
      canSell && !priceGoesUp && tm.setState(TradeState.SELL)
    }

    if (priceGoesUp) {
      // Using previous price two measures back to calculate new stop limit
      const newStopLimit = tm.prices[tm.prices.length - 3] * (1 - this.config.StopLimit);
      tm.stopLimitPrice = tm.stopLimitPrice < newStopLimit ? newStopLimit : tm.stopLimitPrice
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
      memo.stopLimitPrice = tradeResult.price * (1 - this.config.StopLimit);
      this.store.setTrade(memo)
    }
    Log.alert(memo.tradeResult.toString())
  }

  private sellAndClose(memo: TradeMemo): void {
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
