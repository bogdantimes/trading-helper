import { Statistics } from "./Statistics";
import { Exchange, IExchange } from "./Exchange";
import { Log } from "./Common";
import {
  CoinName,
  Config,
  ExchangeSymbol,
  f2,
  floorLastDigit,
  Key,
  MarketTrend,
  PriceMove,
  PricesHolder,
  StableUSDCoin,
  TradeMemo,
  TradeResult,
  TradeState,
} from "../lib/index";
import { PriceProvider } from "./priceprovider/PriceProvider";
import { TradesDao } from "./dao/Trades";
import { ConfigDao } from "./dao/Config";
import { isNode } from "browser-or-node";
import { TradeAction, TradeRequest, TraderPlugin } from "./traders/plugin/api";
import { ChannelsDao } from "./dao/Channels";
import { DefaultStore } from "./Store";
import { CacheProxy } from "./CacheProxy";
import { TrendProvider } from "./TrendProvider";

const MIN_BUY = 15;

export class TradeManager {
  #config: Config;
  #canInvest = 0;
  #balance = 0;
  #optimalInvestRatio = 0;
  #mktTrend: MarketTrend;

  static default(): TradeManager {
    const configDao = new ConfigDao(DefaultStore);
    const config = configDao.get();
    const exchange = new Exchange(config.KEY, config.SECRET);
    const statistics = new Statistics(DefaultStore);
    const tradesDao = new TradesDao(DefaultStore);
    const priceProvider = PriceProvider.default();
    const channelsDao = new ChannelsDao(DefaultStore);
    const trendProvider = new TrendProvider(configDao, exchange, CacheProxy);
    return new TradeManager(
      priceProvider,
      tradesDao,
      configDao,
      channelsDao,
      trendProvider,
      exchange,
      statistics,
      global.TradingHelperLibrary
    );
  }

  constructor(
    private readonly priceProvider: PriceProvider,
    private readonly tradesDao: TradesDao,
    private readonly configDao: ConfigDao,
    private readonly channelsDao: ChannelsDao,
    private readonly trendProvider: TrendProvider,
    private readonly exchange: IExchange,
    private readonly stats: Statistics,
    private readonly plugin: TraderPlugin
  ) {}

  updatePrices(): boolean {
    return this.priceProvider.update();
  }

  trade(): void {
    this.#prepare();

    const { advancedAccess, requests } = this.plugin.trade({
      marketTrend: this.#mktTrend,
      channelsDao: this.channelsDao,
      prices: this.priceProvider.get(StableUSDCoin.BUSD),
    });

    if (advancedAccess !== this.#config.AdvancedAccess) {
      this.#config.AdvancedAccess = advancedAccess;
      this.configDao.set(this.#config);
    }

    if (!this.#config.ViewOnly) {
      requests.forEach((r) => {
        if (r.action === TradeAction.Buy) {
          this.#setBuyState(r);
        } else if (r.action === TradeAction.Sell) {
          this.#setSellState(r);
        }
      });
    }

    const trades = this.tradesDao.getList();
    const inv = trades.filter((t) => t.tradeResult.quantity > 0);
    this.#canInvest = Math.max(0, this.#optimalInvestRatio - inv.length);

    trades.sort(
      isNode
        ? // For back-testing, sorting to ensure tests consistency
          (a, b) => (a.getCoinName() > b.getCoinName() ? 1 : -1)
        : // For production, randomizing the order to avoid biases
          () => Math.random() - 0.5
    );

    const trs = [
      // First process existing trades (some might get sold and free up space to buy new ones)
      ...trades.filter((tm) => !tm.stateIs(TradeState.BUY)),
      // Now process those which were requested to buy
      ...trades.filter((tm) => tm.stateIs(TradeState.BUY)),
    ];
    trs.forEach((tm) => {
      try {
        this.tradesDao.update(tm.getCoinName(), (t) => this.#checkTrade(t));
      } catch (e) {
        Log.alert(`Failed to trade ${tm.getCoinName()}: ${e.message}`);
        Log.error(e);
      }
    });

    this.#finalize();
  }

  buy(coin: CoinName): void {
    this.#prepare();
    const ch = this.channelsDao.get(coin);
    const rangePercent = 1 - ch[Key.MIN] / ch[Key.MAX];
    this.#setBuyState({
      action: TradeAction.Buy,
      coin,
      x: ch[Key.DURATION],
      y: rangePercent,
    });
  }

  sell(coin: CoinName): void {
    this.#prepare();
    this.#setSellState({ action: TradeAction.Sell, coin, x: 0, y: 0 });
  }

  sellAll(sellNow = false): void {
    this.#prepare();

    this.tradesDao.iterate((tm) => {
      tm.resetState();
      if (tm.tradeResult.quantity > 0) {
        tm.setState(TradeState.SELL);
        sellNow && this.#sell(tm);
      }
      return tm;
    });

    this.#finalize();
  }

  #prepare(): void {
    this.#config = this.configDao.get();
    this.#mktTrend = this.trendProvider.get();
    this.#balance = this.#config.StableBalance;
    if (this.#balance === -1) {
      this.#balance = this.exchange.getBalance(this.#config.StableCoin);
    }
    const percentile = this.#mktTrend === MarketTrend.UP ? 0.8 : 0.85;
    const cs = this.channelsDao.getCandidates(percentile);
    this.#optimalInvestRatio = Math.max(1, Math.min(3, Object.keys(cs).length));
  }

  #finalize(): void {
    const diff = this.#balance - this.#config.StableBalance;
    if (diff !== 0) {
      this.#config = this.configDao.get();
      this.#config.StableBalance += diff;
      this.#balance = this.#config.StableBalance;
      this.configDao.set(this.#config);
    }
  }

  #setBuyState(r: TradeRequest): void {
    const stableCoin = this.#config.StableCoin;
    const symbol = new ExchangeSymbol(r.coin, stableCoin);
    this.tradesDao.update(
      r.coin,
      (tm) => {
        tm.setState(TradeState.BUY);
        tm.tradeResult.symbol = symbol;
        return tm;
      },
      () => {
        const tm = new TradeMemo(new TradeResult(symbol));
        tm.setRequestParams({ x: r.x, y: r.y });
        tm.prices = this.priceProvider.get(stableCoin)[r.coin]?.prices;
        tm.setState(TradeState.BUY);
        return tm;
      }
    );
  }

  #setSellState(r: TradeRequest): void {
    this.tradesDao.update(r.coin, (tm) => {
      if (tm.tradeResult.quantity > 0) {
        tm.setState(TradeState.SELL);
      }
      return tm;
    });
  }

  #checkTrade(tm: TradeMemo): TradeMemo {
    this.pushNewPrice(tm);

    if (tm.tradeResult.quantity > 0) {
      this.processBoughtState(tm);
    }

    const priceMove = tm.getPriceMove();

    // take action after processing
    if (
      tm.stateIs(TradeState.SELL) &&
      (tm.stopLimitCrossedDown() || priceMove < PriceMove.UP)
    ) {
      // sell if price stop limit crossed down
      // or the price does not go up anymore
      // this allows to wait if price continues to go up
      this.#sell(tm);
    } else if (tm.stateIs(TradeState.BUY) && priceMove > PriceMove.DOWN) {
      // buy only if price stopped going down
      // this allows to wait if price continues to fall
      const toInvest = this.#getMoneyToInvest(tm);
      if (toInvest > 0) {
        this.#buy(tm, toInvest);
      } else {
        Log.info(`ℹ️ Can't buy ${tm.getCoinName()} - not enough balance`);
        tm.resetState();
      }
    }
    return tm;
  }

  #getMoneyToInvest(tm: TradeMemo): number {
    if (this.#canInvest <= 0 || tm.tradeResult.quantity > 0) {
      // Return 0 if we can't invest or if we already have some coins
      return 0;
    }
    const result = Math.floor(this.#balance / this.#canInvest);
    return result < MIN_BUY ? 0 : result;
  }

  private processBoughtState(tm: TradeMemo): void {
    if (isFinite(tm.ttl)) {
      tm.ttl++;
    } else {
      tm.ttl = 0;
    }

    this.updateStopLimit(tm);

    if (tm.stopLimitCrossedDown()) {
      Log.alert(
        `ℹ️ ${tm.getCoinName()} stop limit crossed down at ${tm.currentPrice}`
      );
      this.#config.SellAtStopLimit && tm.setState(TradeState.SELL);
    }
  }

  private updateStopLimit(tm: TradeMemo): void {
    if (tm.stopLimitPrice === 0) {
      const ch = this.channelsDao.get(tm.getCoinName());
      // Initiate stop limit via the channel lower boundary price
      tm.stopLimitPrice = floorLastDigit(ch[Key.MIN], tm.precision);
      return;
    }

    // c1 is the percentage of the profit goal completion
    // c1 is used to move the stop limit up in the "bottom price" - "goal price" range to the same level
    const c1 = tm.profitPercent() / (tm.profitGoal * 100);

    // c2 is the percentage of the TTL completion
    // c2 is used to move the stop limit up in the "bottom price" - "goal price" range to the same level
    const maxTTL = tm.duration / this.#mktTrend;
    const curTTL = Math.min(tm.ttl, maxTTL);
    let c2 = curTTL / maxTTL;

    // if the stop limit is above the entry price, we don't want to apply TTL stop limit
    if (tm.stopLimitPrice >= tm.tradeResult.price) {
      c2 = 0;
    }

    // apply max of c1 and c2 to the stop limit price
    const c = Math.max(c1, c2);
    const bottomPrice = tm.stopLimitBottomPrice;
    let newStopLimit = bottomPrice + (tm.profitGoalPrice() - bottomPrice) * c;
    // keep the stop limit lower than the current price
    newStopLimit = Math.min(newStopLimit, tm.currentPrice);

    // quantize stop limit to stick it to the grid
    newStopLimit = floorLastDigit(newStopLimit, tm.precision);
    // update the stop limit price if it's higher than the current one
    tm.stopLimitPrice = Math.max(tm.stopLimitPrice, newStopLimit);
  }

  private forceUpdateStopLimit(tm: TradeMemo): void {
    tm.ttl = 0;
    tm.stopLimitPrice = 0;
    this.updateStopLimit(tm);
  }

  private pushNewPrice(tm: TradeMemo): void {
    const priceHolder = this.#getPrices(tm.tradeResult.symbol);
    const symbol = `${tm.getCoinName()}${this.#config.StableCoin}`;
    if (priceHolder) {
      tm.pushPrice(priceHolder.currentPrice);
    } else if (tm.tradeResult.quantity) {
      // no price available, but we have quantity, which means we bought something earlier
      Log.alert(`Exchange does not have price for ${symbol}.`);
      if (isNode) {
        // Only for back-testing, force selling this asset
        // The back-testing exchange mock will use the previous price
        this.#sell(tm);
      }
    } else {
      // no price available, and no quantity, which means we haven't bought anything yet
      // could be a non-existing symbol, or not yet published in the exchange
      Log.info(`Exchange does not have price for ${symbol}`);
      tm.resetState();
    }
  }

  #getPrices(symbol: ExchangeSymbol): PricesHolder {
    return this.priceProvider.get(symbol.priceAsset as StableUSDCoin)[
      symbol.quantityAsset
    ];
  }

  #buy(tm: TradeMemo, cost: number): void {
    const symbol = tm.tradeResult.symbol;
    const tradeResult = this.exchange.marketBuy(symbol, cost);
    if (tradeResult.fromExchange) {
      // any actions should not affect changing the state to BOUGHT in the end
      try {
        this.#canInvest = Math.max(0, this.#canInvest - 1);
        this.#balance -= tradeResult.paid;
        // flatten out prices to make them not cross any limits right after the trade
        tm.prices = [tm.currentPrice];
        // join existing trade result quantity, commission, paid price, etc. with the new one
        tm.joinWithNewTrade(tradeResult);
        // set the stop limit according to the current settings
        this.forceUpdateStopLimit(tm);
        this.processBuyFee(tradeResult);
        Log.alert(
          `${tm.getCoinName()} asset average price: ${tm.tradeResult.price}`
        );
        Log.info(tradeResult.toCVSString());
        Log.debug(tm);
      } catch (e) {
        Log.error(e);
      } finally {
        tm.setState(TradeState.BOUGHT);
      }
    } else {
      Log.alert(`${symbol.quantityAsset} could not be bought: ${tradeResult}`);
      Log.debug(tm);
      tm.resetState();
    }
  }

  #sell(memo: TradeMemo): void {
    const symbol = new ExchangeSymbol(
      memo.tradeResult.symbol.quantityAsset,
      this.#config.StableCoin
    );
    const tradeResult = this.exchange.marketSell(
      symbol,
      memo.tradeResult.quantity
    );
    if (tradeResult.fromExchange) {
      // any actions should not affect changing the state to SOLD in the end
      try {
        this.#canInvest = Math.min(
          this.#optimalInvestRatio,
          this.#canInvest + 1
        );
        this.#balance += tradeResult.gained;
        const fee = this.processSellFee(memo, tradeResult);
        const profit = f2(tradeResult.gained - memo.tradeResult.paid - fee);
        const profitPercentage = f2(100 * (profit / memo.tradeResult.paid));

        Log.alert(
          `ℹ️ ${
            profit >= 0 ? `Profit` : `Loss`
          }: ${profit} (${profitPercentage}%)`
        );

        tradeResult.profit = profit;
        tradeResult.paid = memo.tradeResult.paid;
        Log.info(tradeResult.toCVSString());
        this.updatePLStatistics(symbol.priceAsset as StableUSDCoin, profit);
      } catch (e) {
        Log.error(e);
      } finally {
        memo.tradeResult = tradeResult;
        Log.debug(memo);
        memo.setState(TradeState.SOLD);
        memo.ttl = 0;
      }
    } else {
      Log.debug(memo);
      memo.setState(TradeState.BOUGHT);
      Log.alert(`An issue happened while selling ${symbol}.`);
      Log.alert(tradeResult.toString());
    }

    memo.deleted = memo.stateIs(TradeState.SOLD);
  }

  private updatePLStatistics(gainedCoin: StableUSDCoin, profit: number): void {
    if (StableUSDCoin[gainedCoin]) {
      this.stats.addProfit(profit);
      Log.info(`P/L added to statistics: ${profit}`);
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
    const bnbPriceHolder = this.#getPrices(
      new ExchangeSymbol(`BNB`, this.#config.StableCoin)
    );
    return bnbPriceHolder ? commission * bnbPriceHolder.currentPrice : 0;
  }

  private updateBNBBalance(quantity: number): boolean {
    let updated = false;
    this.tradesDao.update(`BNB`, (tm) => {
      // Changing only quantity, but not cost. This way the BNB amount is reduced, but the paid amount is not.
      // As a result, the BNB profit/loss correctly reflects losses due to paid fees.
      tm.tradeResult.addQuantity(quantity, 0);
      Log.alert(`BNB balance updated by ${quantity}`);
      updated = true;
      return tm;
    });
    return updated;
  }
}
