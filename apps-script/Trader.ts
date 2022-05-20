import {TradeMemo, TradeState} from "./TradeMemo";
import {Statistics} from "./Statistics";
import {Config, DefaultStore, IStore} from "./Store";
import {IExchange} from "./Exchange";
import {ExchangeSymbol, TradeResult} from "./TradeResult";
import {Coin, PriceMap, StableUSDCoin} from "./shared-lib/types";
import {CacheProxy} from "./CacheProxy";

export class V2Trader {
  private readonly store: IStore;
  private readonly config: Config;
  private readonly exchange: IExchange;
  private readonly stats: Statistics;
  private readonly prices: PriceMap;

  /**
   * Used when {@link Config.ProfitBasedStopLimit} is enabled.
   */
  private readonly totalProfit: number;
  /**
   * Used when {@link Config.ProfitBasedStopLimit} is enabled.
   */
  private readonly numberOfBoughtAssets: number;

  constructor(store: IStore, exchange: IExchange, stats: Statistics) {
    this.store = store;
    this.config = store.getConfig();
    this.exchange = exchange
    this.stats = stats
    this.prices = exchange.getPrices()

    if (this.config.ProfitBasedStopLimit) {
      this.totalProfit = stats.getAll().TotalProfit;
      this.numberOfBoughtAssets = store.getTradesList(TradeState.BOUGHT).length;
    }
  }

  tickerCheck(tm: TradeMemo): TradeMemo {
    if (!Coin.isStable(tm.getCoinName())) {
      this.pushNewPrice(tm);
      this.checkDip(tm);
    }

    if (tm.stateIs(TradeState.BOUGHT)) {
      this.processBoughtState(tm);
    } else if (tm.stateIs(TradeState.SOLD)) {
      this.processSoldState(tm);
    }

    const priceGoesUp = tm.priceGoesUp()
    priceGoesUp && Log.info(`${tm.tradeResult.symbol} price goes up`)

    // take action after processing
    if (tm.stateIs(TradeState.SELL) && !priceGoesUp) {
      // sell if price not goes up anymore
      // this allows to wait if price continues to go up
      this.sell(tm)
    } else if (tm.stateIs(TradeState.BUY)) {
      // buy only if price started to go up
      // this allows to wait if price continues to fall
      // or buy if it is a stable coin
      if (priceGoesUp || Coin.isStable(tm.getCoinName())) {
        this.buy(tm, this.config.BuyQuantity)
      }
    }
    return tm;
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

    if (tm.profitLimitCrossedUp(this.config.ProfitLimit)) {
      Log.alert(`${symbol} crossed profit limit at ${tm.currentPrice}`)
    } else if (tm.lossLimitCrossedDown()) {
      Log.alert(`${symbol}: crossed stop limit at ${tm.currentPrice}`)
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

    if (this.config.ProfitBasedStopLimit) {
      const allowedLossPerAsset = this.totalProfit / this.numberOfBoughtAssets;
      tm.stopLimitPrice = (tm.tradeResult.cost - allowedLossPerAsset) / tm.tradeResult.quantity;
    } else if (!tm.stopLimitPrice || tm.priceGoesUp()) {
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

  private buy(tm: TradeMemo, cost: number): void {
    const symbol = tm.tradeResult.symbol;
    const tradeResult = this.exchange.marketBuy(symbol, cost);
    if (tradeResult.fromExchange) {
      this.processBuyFee(tradeResult);
      tm.joinWithNewTrade(tradeResult);
      Log.debug(tm);
    } else {
      Log.alert(`${symbol.quantityAsset} could not be bought: ${tradeResult}`)
      Log.debug(tm);
      tm.resetState();
    }
  }

  private sell(memo: TradeMemo): void {
    const symbol = new ExchangeSymbol(memo.tradeResult.symbol.quantityAsset, this.config.StableCoin);
    const tradeResult = this.exchange.marketSell(symbol, memo.tradeResult.quantity);
    if (tradeResult.fromExchange) {
      const fee = this.processSellFee(memo, tradeResult);
      const profit = +(tradeResult.gained - memo.tradeResult.paid - fee).toFixed(2);
      const profitPercentage = (100 * (profit / memo.tradeResult.paid)).toFixed(2);

      Log.alert(`${profit >= 0 ? 'Profit' : 'Loss'}: ${profit} (${profitPercentage}%)`)

      tradeResult.profit = profit;
      memo.tradeResult = tradeResult;
      Log.debug(memo);
      memo.setState(TradeState.SOLD)
      this.updatePLStatistics(symbol.priceAsset, profit);
    } else {
      Log.debug(memo);
      memo.hodl = true;
      memo.setState(TradeState.BOUGHT);
      Log.alert(`An issue happened while selling ${symbol}. The asset is marked HODL. Please, resolve it manually.`)
      Log.alert(tradeResult.toString());
    }

    if (memo.stateIs(TradeState.SOLD) && this.config.AveragingDown) {
      // all gains are reinvested to most unprofitable asset
      // find a trade with the lowest profit percentage
      const byProfitPercentDesc = (t1, t2) => t1.profitPercent() < t2.profitPercent() ? -1 : 1;
      const lowestProfitTrade = this.store.getTradesList()
        .filter(t => t.stateIs(TradeState.BOUGHT))
        .sort(byProfitPercentDesc)[0];
      if (lowestProfitTrade) {
        Log.alert('Averaging down is enabled')
        Log.alert(`All gains from selling ${symbol} are being invested to ${lowestProfitTrade.tradeResult.symbol}`);
        DefaultStore.changeTrade(lowestProfitTrade.getCoinName(), tm => {
          this.buy(tm, tradeResult.gained);
          return tm;
        });
      }
    }
  }

  private updatePLStatistics(gainedCoin: string, profit: number): void {
    if (Coin.isStable(gainedCoin)) {
      this.stats.addProfit(profit)
      Log.info("P/L added to statistics: " + profit);
    }
  }

  private processBuyFee(buyResult: TradeResult): void {
    if (this.updateBNBBalance(-buyResult.commission)) {
      // if fee paid by existing BNB asset balance, commission can be zeroed in the trade result
      buyResult.commission = 0;
    }
  }

  private processSellFee(tm: TradeMemo, sellResult: TradeResult): number {
    if (this.updateBNBBalance(-sellResult.commission)) {
      // if fee paid by existing BNB asset balance, commission can be zeroed in the trade result
      sellResult.commission = 0;
    }
    const buyFee = this.getBNBCommissionCost(tm.tradeResult.commission);
    const sellFee = this.getBNBCommissionCost(sellResult.commission);
    return buyFee + sellFee;
  }

  private getBNBCommissionCost(commission: number): number {
    const bnbPrice = this.prices["BNB" + this.config.StableCoin];
    return bnbPrice ? commission * bnbPrice : 0;
  }

  private updateBNBBalance(quantity: number): boolean {
    let updated = false;
    DefaultStore.changeTrade("BNB", tm => {
      if (tm.tradeResult.fromExchange) {
        // Changing only quantity, but not cost. This way the BNB amount is reduced, but the paid amount is not.
        // As a result, the BNB profit/loss correctly reflects losses due to paid fees.
        tm.tradeResult.addQuantity(quantity, 0);
        Log.alert(`BNB balance updated by ${quantity}`);
        updated = true;
        return tm;
      }
    });
    return updated;
  }

  updateStableCoinsBalance() {
    Object.keys(StableUSDCoin).forEach(coin => DefaultStore.changeTrade(coin, tm => {
      const balance = this.exchange.getFreeAsset(tm.getCoinName());
      if (balance) {
        tm.setState(tm.getState() || TradeState.BOUGHT);
        tm.tradeResult = new TradeResult(tm.tradeResult.symbol, "Stable coin");
        tm.tradeResult.quantity = balance;
        tm.tradeResult.fromExchange = true;
        tm.hodl = true;
      } else {
        tm.deleted = true;
      }
      return tm;
    }));
  }

  private checkDip(tm: TradeMemo) {
    if (tm.prices.length < TradeMemo.PriceMemoMaxCapacity) return false;

    const key = `${tm.getCoinName()}-dip-start`;
    const growthIndex = tm.getGrowthIndex(tm.prices.slice(-TradeMemo.PriceMemoMaxCapacity));
    const dipStartPrice = CacheProxy.get(key);

    if (growthIndex + TradeMemo.PriceMemoMaxCapacity <= 2) {
      CacheProxy.put(key, dipStartPrice || tm.prices[0].toString(), 120); // 2 minutes
    } else if (dipStartPrice) {
      const percentage = 100 * (tm.currentPrice / +dipStartPrice)
      Log.alert(`${percentage.toFixed(2)} dip in ${tm.getCoinName()} price: ${dipStartPrice} -> ${tm.currentPrice}`);
      CacheProxy.remove(key);
    }
  }
}
