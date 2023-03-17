import { Statistics } from "./Statistics";
import { Exchange, type IExchange } from "./Exchange";
import { backTestSorter, Log } from "./Common";
import {
  AUTO_DETECT,
  BNB,
  type CoinName,
  type Config,
  ExchangeSymbol,
  f2,
  f8,
  floor,
  floorToOptimalGrid,
  Key,
  MarketTrend,
  MIN_BUY,
  PriceMove,
  type PricesHolder,
  StableUSDCoin,
  TradeMemo,
  TradeResult,
  TradeState,
  BNBFee,
} from "../lib/index";
import { PriceProvider } from "./priceprovider/PriceProvider";
import { TradesDao } from "./dao/Trades";
import { ConfigDao } from "./dao/Config";
import { isNode } from "browser-or-node";
import {
  type Signal,
  SignalType,
  type TraderPlugin,
} from "./traders/plugin/api";
import { ChannelsDao } from "./dao/Channels";
import { DefaultStore } from "./Store";
import { CacheProxy } from "./CacheProxy";
import { TrendProvider } from "./TrendProvider";

export class TradeManager {
  #config: Config;
  #canInvest = 0;
  #balance = 0;
  #optimalInvestRatio = 0;
  #mktTrend: MarketTrend;

  static default(): TradeManager {
    const configDao = new ConfigDao(DefaultStore);
    const exchange = new Exchange(configDao);
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

    const trades = this.tradesDao.getList();
    const invested = trades.filter((t) => t.tradeResult.quantity).length;
    this.#canInvest = Math.max(1, this.#optimalInvestRatio - invested);

    // First process !BUY state assets (some might get sold and free up $)
    trades
      .filter((tm) => !tm.stateIs(TradeState.BUY))
      .forEach((tm) => {
        this.#tryCheckTrade(tm);
      });

    // Run plugin to update candidates and also get buy candidates if we can invest
    const { advancedAccess, signals } = this.plugin.trade({
      marketTrend: this.#mktTrend,
      channelsDao: this.channelsDao,
      prices: this.priceProvider.get(this.#config.StableCoin),
      stableCoin: this.#config.StableCoin,
      provideSignals: this.#getMoneyToInvest() > 0,
      checkImbalance: this.#config.EntryImbalanceCheck,
    });

    if (advancedAccess !== this.#config.AdvancedAccess) {
      this.#config.AdvancedAccess = advancedAccess;
      this.configDao.set(this.#config);
    }

    if (!this.#config.ViewOnly) {
      signals
        .filter((r) => r.type === SignalType.Buy)
        .forEach((r) => {
          this.#setBuyState(r);
        });
    }

    // Now process trades which are yet to be bought
    // For back-testing, sort by name to ensure tests consistency
    // For production, randomizing the order to avoid biases
    this.tradesDao
      .getList(TradeState.BUY)
      .sort(backTestSorter)
      .forEach((tm) => {
        this.#tryCheckTrade(tm);
      });

    this.#finalize();
  }

  buy(coin: CoinName): void {
    this.#prepare();
    const ch = this.channelsDao.get(coin);
    this.#setBuyState({
      type: SignalType.Buy,
      coin,
      duration: ch?.[Key.DURATION],
      rangeSize: ch?.[Key.SIZE],
      imbalance: ch?.[Key.IMBALANCE],
    });
  }

  sell(coin: CoinName): void {
    this.#prepare();
    this.tradesDao.update(coin, (t) => this.#sellNow(t));
    this.#finalize();
  }

  sellAll(): void {
    this.#prepare();
    this.tradesDao.iterate((t) => this.#sellNow(t));
    this.#finalize();
  }

  #sellNow(tm: TradeMemo): TradeMemo {
    // Reset potential BUY state to avoid buying for the time being
    tm.resetState();
    if (tm.tradeResult.quantity > 0) {
      this.#sell(tm);
    } else if (tm.getState() === TradeState.BOUGHT) {
      Log.alert(`⚠️ Can't sell ${tm.getCoinName()}. Current value is 0`);
    }
    return tm;
  }

  #prepare(): void {
    this.#initStableBalance();
    this.#mktTrend = this.trendProvider.get();
    const percentile = this.#mktTrend === MarketTrend.UP ? 0.8 : 0.85;
    const cs = this.plugin.getCandidates(this.channelsDao, percentile);
    this.#optimalInvestRatio = Math.max(1, Math.min(3, Object.keys(cs).length));
  }

  #initStableBalance(): void {
    this.#config = this.configDao.get();
    this.#balance = this.#config.StableBalance;
    if (
      this.#balance === AUTO_DETECT &&
      this.#config.KEY &&
      this.#config.SECRET
    ) {
      try {
        this.#balance = this.exchange.getBalance(this.#config.StableCoin);
        // if balance > 0 it will be saved in #finalize()
        // otherwise the tool will try to get it again next time
        this.#config.StableBalance = 0;
      } catch (e) {
        Log.alert(
          `⚠️ Couldn't read the initial ${
            this.#config.StableCoin
          } balance. It was set to $0, you can change in the Settings.`
        );
        // It should stop trying to get the balance if it failed. Setting it to 0 will do that.
        this.#balance = 0;
        this.#config.StableBalance = 0;
        this.configDao.set(this.#config);
      }
    }
  }

  #reFetchFeesBudget(): void {
    if (this.#config.KEY && this.#config.SECRET) {
      try {
        const base = this.#config.StableCoin;
        const price = this.priceProvider.get(base)[BNB]?.currentPrice;
        this.#config.FeesBudget = this.exchange.getBalance(BNB) * price;
      } catch (e) {
        Log.alert(
          `⚠️ Couldn't update fees budget. It was reset to 0. Next attempt is after next trade or during balance auto-detect.`
        );
        this.#config.FeesBudget = 0;
      }
    }
  }

  #finalize(): void {
    // Update balances only if the balance changed
    // Or if FeesBudget is not set
    const diff = this.#balance - this.#config.StableBalance;
    if (diff !== 0 || this.#config.FeesBudget === AUTO_DETECT) {
      this.#config = this.configDao.get(); // Get the latest config
      this.#balance = Math.max(this.#config.StableBalance, 0) + diff;
      this.#config.StableBalance = this.#balance;
      this.#reFetchFeesBudget();
      // Check if AutoReplenishFeesBudget is enabled
      if (this.#config.AutoReplenishFees) {
        try {
          this.#replenishFeesBudget();
        } catch (e) {
          Log.error(new Error(`Failed to replenish fees budget`));
          Log.error(e);
        }
      }
      this.configDao.set(this.#config);
      Log.info(
        `Free ${this.#config.StableCoin} balance: $${f2(this.#balance)}`
      );
      Log.info(`Fees budget: ~$${f2(this.#config.FeesBudget)}`);
    }
  }

  #replenishFeesBudget(): void {
    const stableBalance = this.#balance;
    const feesBudget = this.#config.FeesBudget;
    const assetsValue = this.tradesDao.totalAssetsValue();
    const total = stableBalance + assetsValue;

    if (total <= 0) {
      return;
    }

    const approxTrades = Math.max(
      0,
      Math.floor(feesBudget / (total * BNBFee * 2))
    );

    // If the number of covered trades is below 10, buy additional BNB
    if (approxTrades < 10) {
      const bnbToBuy =
        (total * BNBFee * 2 * (10 - approxTrades)) /
        this.priceProvider.get(this.#config.StableCoin)[BNB]?.currentPrice;
      Log.alert(
        `Need to buy ${bnbToBuy} BNB to replenish feesBudget up to 10 trades`
      );
      Log.debug({
        feesBudget,
        stableBalance,
        assetsValue,
        approxTrades,
        bnbToBuy,
      });
    }
  }

  #setBuyState(r: Signal): void {
    const stableCoin = this.#config.StableCoin;
    const symbol = new ExchangeSymbol(r.coin, stableCoin);
    this.tradesDao.update(
      r.coin,
      (tm) => {
        tm.setState(TradeState.BUY);
        tm.setSignalMetadata(r);
        tm.tradeResult.symbol = symbol;
        return tm;
      },
      () => {
        const tm = new TradeMemo(new TradeResult(symbol));
        tm.setSignalMetadata(r);
        tm.prices = this.priceProvider.get(stableCoin)[r.coin]?.prices;
        tm.setState(TradeState.BUY);
        return tm;
      }
    );
  }

  #setSellState(coin: CoinName): void {
    this.tradesDao.update(coin, (tm) => {
      if (tm.tradeResult.quantity > 0) {
        tm.setState(TradeState.SELL);
      }
      return tm;
    });
  }

  #tryCheckTrade(tm: TradeMemo): void {
    try {
      this.tradesDao.update(tm.getCoinName(), (t) => this.#checkTrade(t));
    } catch (e) {
      Log.alert(`Failed to process ${tm.getCoinName()}: ${e.message}`);
      Log.error(e);
    }
  }

  #checkTrade(tm: TradeMemo): TradeMemo {
    this.#pushNewPrice(tm);

    if (tm.tradeResult.quantity > 0) {
      this.#processBoughtState(tm);
    } else if (tm.tradeResult.soldPrice) {
      this.#processSoldState(tm);
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
    }

    // buy only if price stopped going down
    // this allows to wait if price continues to fall
    if (tm.stateIs(TradeState.BUY) && priceMove > PriceMove.DOWN) {
      const money = this.#getMoneyToInvest();
      // do not invest into the same coin
      if (tm.tradeResult.quantity <= 0 && money > 0) {
        this.#buy(tm, money);
      } else {
        Log.info(`ℹ️ Can't buy ${tm.getCoinName()} - not enough balance`);
        tm.resetState(); // Cancel BUY state
      }
    }

    return tm;
  }

  #getMoneyToInvest(): number {
    if (
      this.#canInvest <= 0 ||
      this.#balance === AUTO_DETECT ||
      this.#balance < MIN_BUY
    ) {
      return 0; // Return 0 if we can not invest
    }
    return Math.max(MIN_BUY, Math.floor(this.#balance / this.#canInvest));
  }

  #processBoughtState(tm: TradeMemo): void {
    tm.ttl = isFinite(tm.ttl) ? tm.ttl + 1 : 0;

    this.#updateStopLimit(tm);

    if (this.#config.SellAtStopLimit && tm.stopLimitCrossedDown()) {
      tm.setState(TradeState.SELL);
    }
  }

  #updateStopLimit(tm: TradeMemo): void {
    const symbol = tm.tradeResult.symbol;

    if (!tm.tradeResult.lotSizeQty) {
      tm.tradeResult.lotSizeQty = this.exchange.quantityForLotStepSize(
        symbol,
        tm.tradeResult.quantity
      );
    }

    const precision = tm.precision;
    const slCrossedDown = tm.stopLimitCrossedDown();

    if (!tm.smartExitPrice) {
      const ch = this.channelsDao.get(tm.getCoinName());
      // Initiate stop limit via the channel lower boundary price
      tm.smartExitPrice = floorToOptimalGrid(ch[Key.MIN], precision).result;
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
    if (tm.smartExitPrice >= tm.tradeResult.entryPrice) {
      c2 = 0;
    }

    // apply max of c1 and c2 to the stop limit price
    const c = Math.max(c1, c2);
    const bottomPrice = tm.stopLimitBottomPrice;
    let newStopLimit = bottomPrice + (tm.profitGoalPrice - bottomPrice) * c;
    // keep the stop limit lower than the current price
    newStopLimit = Math.min(newStopLimit, tm.currentPrice);

    // quantize stop limit to stick it to the grid
    newStopLimit = floorToOptimalGrid(newStopLimit, precision).result;
    // Apply new stop limit if it is higher.
    tm.smartExitPrice = Math.max(tm.smartExitPrice, newStopLimit);

    if (slCrossedDown && tm.profit() <= 0 && tm.currentPrice > bottomPrice) {
      this.#handleEarlyExit(tm);
    }
  }

  #handleEarlyExit(tm: TradeMemo): void {
    const msg = `${tm.getCoinName()} smart exit was crossed down at ${f8(
      tm.smartExitPrice
    )}`;
    try {
      // Allow stop-limit be lowered when it is crossed down,
      // but the order book imbalance is bullish (more buyers than sellers),
      // to avoid selling at turnarounds.
      if (this.#lowerStopLimitIfSupportIsPresent(tm)) {
        this.#config.SellAtStopLimit &&
          Log.alert(
            `⚠ ${msg}, but there are buyers to support the price. Not selling yet.`
          );
      } else {
        Log.info(`${msg} and there are no enough buyers to support the price.`);
      }
    } catch (e) {
      this.#config.SellAtStopLimit &&
        Log.info(`${msg}. Couldn't check the buyers support for the price.`);
    }
  }

  #lowerStopLimitIfSupportIsPresent(tm: TradeMemo): boolean {
    const symbol = tm.tradeResult.symbol;
    const precision = this.exchange.getPricePrecision(symbol);
    const bidCutOffPrice = tm.stopLimitBottomPrice;

    // calculate how many records for imbalance we need for this cut off price
    const step = 1 / Math.pow(10, precision);
    const diff = tm.currentPrice - bidCutOffPrice;
    const optimalLimit = 2 * Math.floor(diff / step);

    const imbalance = this.exchange.getImbalance(
      symbol,
      optimalLimit,
      bidCutOffPrice
    );
    Log.debug(
      `Imbalance: ${f2(imbalance)} (bidCutOffPrice: ${f8(bidCutOffPrice)})`
    );
    const supportIsPresent = imbalance > 0.15;
    if (supportIsPresent) {
      const floor = floorToOptimalGrid(tm.currentPrice, precision);
      tm.smartExitPrice = floor.result;
      tm.ttl -= 240; // Cool down
    }
    return supportIsPresent;
  }

  #forceUpdateStopLimit(tm: TradeMemo): void {
    tm.ttl = 0;
    tm.smartExitPrice = 0;
    this.#updateStopLimit(tm);
  }

  #pushNewPrice(tm: TradeMemo): void {
    const priceHolder = this.#getPrices(tm.tradeResult.symbol);

    if (isNode && !priceHolder?.currentPrice) {
      // Only for back-testing, force selling this asset
      // The back-testing exchange mock will use the previous price
      this.#sell(tm);
      return;
    }

    const symbol = `${tm.getCoinName()}${this.#config.StableCoin}`;
    if (priceHolder?.currentPrice) {
      tm.pushPrice(priceHolder.currentPrice);
    } else if (tm.tradeResult.quantity) {
      // no price available, but we have quantity, which means we bought something earlier
      Log.alert(
        `Exchange does not have price for ${symbol}. Try another Stable Coin in Settings.`
      );
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
        // join existing trade result quantity, commission, paid price, etc. with the new one
        tm.joinWithNewTrade(tradeResult);
        // set the stop limit according to the current settings
        this.#forceUpdateStopLimit(tm);
        this.#processBuyFee(tradeResult);
        Log.info(
          `${tm.getCoinName()} asset avg. price: $${f8(
            tm.tradeResult.avgPrice
          )}`
        );
        Log.debug(tm);
      } catch (e) {
        Log.error(e);
      } finally {
        tm.setState(TradeState.BOUGHT);
      }
    } else {
      Log.alert(`${symbol.quantityAsset} could not be bought: ${tradeResult}`);
      Log.debug(tradeResult);
      Log.debug(tm);
      tm.resetState();
    }
  }

  #sell(memo: TradeMemo): void {
    const entry = memo.tradeResult;
    const coin = memo.getCoinName();
    const symbol = new ExchangeSymbol(coin, this.#config.StableCoin);
    const exit = this.exchange.marketSell(symbol, entry.quantity);
    if (exit.fromExchange) {
      // any actions should not affect changing the state to SOLD in the end
      try {
        this.#canInvest = Math.min(
          this.#optimalInvestRatio,
          this.#canInvest + 1
        );
        this.#balance += exit.gained;
        const fee = this.#processSellFee(entry, exit);
        const profit = exit.gained - entry.paid - fee;
        const profitPercentage = 100 * (profit / entry.paid);

        exit.paid = entry.paid + fee;

        Log.alert(
          `ℹ️ Gained: $${f2(exit.gained)} | ${
            profit >= 0 ? `Profit` : `Loss`
          }: $${f2(profit)} (${f2(profitPercentage)}%)`
        );

        // Alert the following CSV string:
        // Entry Date,Coin/Token,Invested,Quantity,Entry Price,Exit Date,Exit Price,Gained,% Profit/Loss
        const exitDate = new Date().toLocaleDateString();
        // Derive entry date using ttl minutes
        const entryDate = new Date(
          new Date().getTime() - memo.ttl * 60 * 1000
        ).toLocaleDateString();
        const entryPrice = floor(entry.avgPrice, memo.precision);
        const exitPrice = floor(exit.avgPrice, memo.precision);
        Log.info(
          `<table><tr><th>Entry Date</th><th>Coin/Token</th><th>Invested</th><th>Quantity</th><th>Entry Price</th><th>Exit Date</th><th>Exit Price</th><th>Gained</th><th>% Profit/Loss</th></tr><tr><td>${entryDate}</td><td>${coin}</td><td>$${f2(
            entry.paid
          )}</td><td>${
            entry.quantity
          }</td><td>$${entryPrice}</td><td>${exitDate}</td><td>$${exitPrice}</td><td>$${f2(
            exit.gained
          )}</td><td>${f2(profitPercentage)}%</td></tr></table>`
        );

        this.#updatePLStatistics(symbol.priceAsset as StableUSDCoin, profit);
      } catch (e) {
        Log.error(e);
      } finally {
        memo.tradeResult = exit;
        Log.debug(memo);
        memo.setState(TradeState.SOLD);
      }
    } else {
      Log.debug(exit);
      Log.debug(memo);
      memo.setState(TradeState.BOUGHT);
      Log.alert(`An issue happened while selling ${symbol}: ${exit}`);
    }
  }

  #updatePLStatistics(gainedCoin: StableUSDCoin, profit: number): void {
    if (StableUSDCoin[gainedCoin]) {
      this.stats.addProfit(profit);
    }
  }

  #processBuyFee(entry: TradeResult): void {
    if (
      // If non BNB asset was bought, try to reduce existing BNB assets qty if it exists
      entry.symbol.quantityAsset !== BNB &&
      this.#reduceBNBBalance(entry.commission)
    ) {
      // if fee paid by existing BNB asset balance, commission can be zeroed in the trade result
      entry.commission = 0;
    }
  }

  #processSellFee(entry: TradeResult, exit: TradeResult): number {
    if (
      // If non BNB asset was sold, try to reduce existing BNB assets qty if it exists
      entry.symbol.quantityAsset !== BNB &&
      this.#reduceBNBBalance(exit.commission)
    ) {
      // if fee paid by existing BNB asset balance, commission can be zeroed in the trade result
      exit.commission = 0;
    }
    // Calculate the final summary fee (buy + sell)
    const buyFee = this.#getBNBCommissionCost(entry.commission);
    const sellFee = this.#getBNBCommissionCost(exit.commission);
    return buyFee + sellFee;
  }

  #getBNBCommissionCost(commission: number): number {
    if (!commission) return 0;
    const bnbPriceHolder = this.#getPrices(
      new ExchangeSymbol(BNB, this.#config.StableCoin)
    );
    return bnbPriceHolder ? commission * bnbPriceHolder.currentPrice : 0;
  }

  #reduceBNBBalance(reduceQty: number): boolean {
    if (reduceQty <= 0) return false;

    let updated = false;
    this.tradesDao.update(BNB, (tm) => {
      // Do nothing if the BNB asset is not owned
      if (tm.tradeResult.quantity <= 0) return;

      const curBNB = this.exchange.getBalance(BNB);
      const remainingQty = Math.max(0, curBNB - reduceQty);

      if (remainingQty >= tm.tradeResult.quantity) {
        // Do nothing if the BNB asset qty is not affected
        return;
      }

      if (remainingQty <= 0) {
        Log.alert(
          `After paying fees, there is no more ${BNB} asset remaining and it is being removed from the portfolio.`
        );
        tm.deleted = true;
        return tm;
      }

      // Set remaining BNB asset qty.
      // The asset BNB profit/loss correctly reflects "losses" due to paid fees.
      tm.tradeResult.setQuantity(remainingQty);
      Log.alert(
        `Remaining ${BNB} asset quantity was reduced after paying the trade fees.`
      );
      updated = true;
      return tm;
    });

    return updated;
  }

  #processSoldState(tm: TradeMemo): void {
    // Delete the sold trade after a day
    tm.ttl = isFinite(tm.ttl) ? tm.ttl + 1 : 0;
    if (tm.ttl >= 1440) {
      tm.deleted = true;
    }
  }
}
