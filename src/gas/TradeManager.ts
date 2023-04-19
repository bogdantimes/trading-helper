import { Statistics } from "./Statistics";
import { type IExchange } from "./IExchange";
import { backTestSorter, Log } from "./Common";
import {
  AUTO_DETECT,
  BNB,
  BNBFee,
  type CoinName,
  type Config,
  ExchangeSymbol,
  f2,
  f8,
  floor,
  floorToOptimalGrid,
  type ICandidatesDao,
  Key,
  MIN_BUY,
  MINIMUM_FEE_COVERAGE,
  type PricesHolder,
  StableUSDCoin,
  TARGET_FEE_COVERAGE,
  TradeMemo,
  TradeResult,
  TradeState,
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
import { DefaultStore } from "./Store";
import { CandidatesDao } from "./dao/Candidates";
import { Binance } from "./Binance";

export class TradeManager {
  #config: Config;
  #balance = 0;
  // TODO: take from config
  #numInvested = 0;
  #maxInvested = 5;

  static default(): TradeManager {
    const configDao = new ConfigDao(DefaultStore);
    const exchange = new Binance(configDao);
    const statistics = new Statistics(DefaultStore);
    const tradesDao = new TradesDao(DefaultStore);
    const candidatesDao = new CandidatesDao(DefaultStore);
    const priceProvider = PriceProvider.default();
    return new TradeManager(
      priceProvider,
      tradesDao,
      candidatesDao,
      configDao,
      exchange,
      statistics,
      global.TradingHelperLibrary
    );
  }

  constructor(
    private readonly priceProvider: PriceProvider,
    private readonly tradesDao: TradesDao,
    private readonly candidatesDao: ICandidatesDao,
    private readonly configDao: ConfigDao,
    private readonly exchange: IExchange,
    private readonly stats: Statistics,
    private readonly plugin: TraderPlugin
  ) {}

  updatePrices(): boolean {
    return this.priceProvider.update();
  }

  trade(step: number): void {
    this.#prepare();

    const trades = this.tradesDao.getList();
    this.#numInvested = trades.filter((t) => t.tradeResult.quantity).length;

    // First process !BUY state assets (some might get sold and free up $)
    trades
      .filter((tm) => !tm.stateIs(TradeState.BUY))
      .sort(backTestSorter)
      .forEach((tm) => {
        this.#tryCheckTrade(tm);
      });

    // Run plugin to update candidates and also get buy candidates if we can invest
    const { advancedAccess, signals } = this.plugin.trade({
      prices: this.priceProvider.get(this.#config.StableCoin),
      stableCoin: this.#config.StableCoin,
      provideSignals: this.#balance > MIN_BUY ? 5 : 0,
      candidatesDao: this.candidatesDao,
      I: step,
    });

    if (advancedAccess !== this.#config.AdvancedAccess) {
      this.#config.AdvancedAccess = advancedAccess;
      this.configDao.set(this.#config);
    }

    if (!this.#config.ViewOnly) {
      signals
        // Ignore BNB buy signals cos of conflicts with fee logic
        .filter((r) => r.type === SignalType.Buy && r.coin !== BNB)
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
    const price = this.priceProvider.get(this.#config.StableCoin)[coin]
      ?.currentPrice;
    if (price) {
      this.#setBuyState({
        type: SignalType.Buy,
        coin,
        target: price * 1.02,
      });
    } else {
      throw new Error(`Unknown coin ${coin}: no price information found`);
    }
  }

  sell(coin: CoinName): void {
    this.#prepare();
    this.tradesDao.update(
      coin,
      (t) => this.#sellNow(t),
      () => {
        Log.alert(`${coin} not found`);
        return null;
      }
    );
    this.#finalize();
  }

  sellAll(): void {
    this.#prepare();
    this.tradesDao.iterate((t) => this.#sellNow(t));
    this.#finalize();
  }

  import(coins: CoinName[]): void {
    const stableCoin = this.configDao.get().StableCoin;

    const importTrade = (coinName: CoinName) => {
      if (!this.exchange.importTrade) {
        throw new Error(`Import is not supported by the exchange`);
      }
      const symbol = new ExchangeSymbol(coinName, stableCoin);
      return this.exchange.importTrade(symbol);
    };

    const importedTradeResults = coins.map(importTrade);

    this.#prepare();

    importedTradeResults.forEach((importedTrade) => {
      const coin = importedTrade.symbol.quantityAsset;
      if (importedTrade.fromExchange) {
        this.tradesDao.update(
          coin,
          (t) => {
            // existing coin
            Log.alert(
              `Import cancelled: ${t.getCoinName()} already exists in the portfolio.`
            );
            return null;
          },
          () => {
            const tm = new TradeMemo(importedTrade);
            tm.prices = this.priceProvider.get(stableCoin)[coin]?.prices;
            tm.highestPrice = tm.currentPrice;
            tm.lowestPrice = floorToOptimalGrid(
              tm.currentPrice,
              this.exchange.getPricePrecision(importedTrade.symbol)
            ).result;
            tm.setState(TradeState.BOUGHT);
            Log.alert(`➕ Imported ${coin}`);
            Log.info(`${coin} asset cost: $${tm.tradeResult.paid}`);
            Log.info(`${coin} asset quantity: ${tm.tradeResult.quantity}`);
            Log.info(
              `${coin} asset avg. price: $${f8(tm.tradeResult.avgPrice)}`
            );
            return tm;
          }
        );
      } else {
        Log.alert(`${coin} could not be imported: ${importedTrade.msg}`);
      }
    });

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
          Log.alert(
            `"Replenish fees budget" feature was disable. Check manually and re-enable if issue is resolved.`
          );
          this.#config.AutoReplenishFees = false;
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
    if (this.#config.ViewOnly || this.#balance <= MIN_BUY) return;

    const feesBudget = this.#config.FeesBudget;
    const assetsValue = this.tradesDao.totalAssetsValue();
    const total = this.#balance + assetsValue;

    if (total <= 0) return;

    const curCover = Math.max(0, Math.floor(feesBudget / (total * BNBFee * 2)));
    // If the number of covered trades is below 3, buy additional BNB to cover 10 trades
    if (curCover >= MINIMUM_FEE_COVERAGE) return;

    const target = TARGET_FEE_COVERAGE;
    const stableCoin = this.#config.StableCoin;
    const bnbSym = new ExchangeSymbol(BNB, stableCoin);
    const budgetNeeded = total * BNBFee * 2 * (target - curCover);

    if (this.#balance - budgetNeeded < MIN_BUY) {
      Log.info(
        `Fees budget cannot be replenished to cover ~${target} trades as free balance is not enough. It needs at least $${f2(
          budgetNeeded + MIN_BUY
        )}.`
      );
      return;
    }

    const tr = this.exchange.marketBuy(bnbSym, budgetNeeded);
    if (!tr.fromExchange) {
      throw new Error(`Failed to replenish fees budget: ${tr.msg}`);
    }
    this.#config.FeesBudget += tr.paid;
    this.#balance -= tr.paid;
    this.#config.StableBalance = this.#balance;
    Log.alert(
      `Fees budget replenished to cover ~${target} trades. Before: $${f2(
        feesBudget
      )}, added: ${tr.quantity} BNB, now: $${f2(this.#config.FeesBudget)}.`
    );
    Log.debug({
      feesBudget,
      freeBalance: this.#balance,
      assetsValue,
      curCover,
      budgetNeeded,
    });
  }

  #setBuyState(r: Signal): void {
    const stableCoin = this.#config.StableCoin;
    const symbol = new ExchangeSymbol(r.coin, stableCoin);
    this.tradesDao.update(
      r.coin,
      (tm) => {
        if (tm.currentValue) {
          // Ignore if coin is already bought.
          tm.resetState();
          return tm;
        }
        tm.setSignalMetadata(r);
        tm.tradeResult.symbol = symbol;
        tm.highestPrice = tm.currentPrice;
        tm.lowestPrice = floorToOptimalGrid(
          tm.currentPrice,
          this.exchange.getPricePrecision(symbol)
        ).result;
        tm.setState(TradeState.BUY);
        return tm;
      },
      () => {
        const tm = new TradeMemo(new TradeResult(symbol));
        tm.setSignalMetadata(r);
        tm.prices = this.priceProvider.get(stableCoin)[r.coin]?.prices;
        tm.highestPrice = tm.currentPrice;
        tm.lowestPrice = floorToOptimalGrid(
          tm.currentPrice,
          this.exchange.getPricePrecision(symbol)
        ).result;
        tm.setState(TradeState.BUY);
        return tm;
      }
    );
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

    tm.ttl = isFinite(tm.ttl) ? tm.ttl + 1 : 0;

    if (tm.tradeResult.quantity > 0 && this.#config.SmartExit) {
      this.#processBoughtState(tm);
    } else if (tm.tradeResult.soldPrice) {
      this.#processSoldState(tm);
    }

    // take action after processing
    if (tm.stateIs(TradeState.SELL)) {
      this.#sell(tm);
    }

    if (tm.stateIs(TradeState.BUY)) {
      const money = this.#getMoneyToInvest(tm);
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

  #getMoneyToInvest(tm: TradeMemo): number {
    if (this.#balance < MIN_BUY) {
      return 0;
    }
    const maxAssets = 3;
    const qtStep = 1 / Math.max(1, maxAssets - this.#numInvested);
    const qtImb = Math.ceil(tm.supplyDemandImbalance * (1 / qtStep)) * qtStep;
    const balanceMul = Math.min(Math.max(qtImb, 1 / maxAssets), 1);
    // get all or part of balance depending on supplyDemandImbalance
    return Math.max(MIN_BUY, Math.floor(this.#balance * balanceMul));
  }

  #processBoughtState(tm: TradeMemo): void {
    tm.support = this.#getSupportLevel(tm);

    // This will init fields, or just use current values
    tm.highestPrice = tm.highestPrice || tm.currentPrice;
    tm.lowestPrice =
      tm.lowestPrice ||
      floorToOptimalGrid(
        tm.currentPrice,
        this.exchange.getPricePrecision(tm.tradeResult.symbol)
      ).result;

    if (tm.currentPrice < tm.support) {
      tm.setState(TradeState.SELL);
      return;
    }

    if (tm.currentPrice < tm.lowestPrice && tm.ttl > 5) {
      this.#handleLowerLow(tm);
    }

    if (tm.currentPrice > tm.highestPrice && tm.ttl > 5) {
      this.#handleHigherHigh(tm);
    }
  }

  #getSupportLevel(tm: TradeMemo) {
    // -10% as a safeguard if no candidate info
    return (
      this.candidatesDao.getAll()[tm.getCoinName()]?.[Key.MIN] ||
      tm.tradeResult.entryPrice * 0.9
    );
  }

  #getImbalance(tm: TradeMemo): { imbalance: number; precision: number } {
    const symbol = tm.tradeResult.symbol;
    const precision = this.exchange.getPricePrecision(symbol);
    const bidCutOffPrice = tm.support;

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
    tm.supplyDemandImbalance = imbalance;
    return { precision, imbalance };
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
        this.#numInvested = Math.max(0, this.#numInvested - 1);
        this.#balance -= tradeResult.paid;
        // join existing trade result quantity, commission, paid price, etc. with the new one
        tm.joinWithNewTrade(tradeResult);
        tm.ttl = 0;
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
        this.#numInvested = Math.min(this.#maxInvested, this.#numInvested + 1);
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
    // Delete the sold trade after a while
    if (tm.ttl >= 1440) {
      tm.deleted = true;
    }
  }

  #handleLowerLow(tm: TradeMemo): void {
    const { imbalance, precision } = this.#getImbalance(tm);

    // Set new lowest price little lower than the current
    const nextLowPrice = tm.currentPrice * 0.99;
    tm.lowestPrice = floorToOptimalGrid(nextLowPrice, precision).result;

    const percent = tm.profitPercent();
    let imbThreshold = Math.abs(percent * 6) / 100;
    if (tm.ttl >= 2000) {
      imbThreshold *= tm.ttl / 2000;
    }
    if (imbalance < imbThreshold) {
      tm.setState(TradeState.SELL);
    }
  }

  #handleHigherHigh(tm: TradeMemo): void {
    const { imbalance, precision } = this.#getImbalance(tm);

    const nextHighPrice = tm.currentPrice * 1.01;
    // Set new highest price little higher than the current
    tm.highestPrice = floorToOptimalGrid(nextHighPrice, precision).result;

    const percent = tm.profitPercent();
    let imbThreshold = Math.abs(percent * 4) / 100;
    if (tm.ttl >= 2000) {
      imbThreshold *= tm.ttl / 2000;
    }
    if (imbalance < Math.min(0.6, imbThreshold)) {
      tm.setState(TradeState.SELL);
    }
  }
}
