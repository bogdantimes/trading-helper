import { Statistics } from "./Statistics";
import { type IExchange } from "./IExchange";
import { Log, signalSorter, tmSorter } from "./Common";
import {
  AUTO_DETECT,
  BNB,
  BNBFee,
  type CoinName,
  type Config,
  ExchangeSymbol,
  f0,
  f2,
  f8,
  floor,
  floorToOptimalGrid,
  type ICandidatesDao,
  MIN_BUY,
  MINIMUM_FEE_COVERAGE,
  prettyPrintTradeMemo,
  type PricesHolder,
  StableUSDCoin,
  SymbolStatus,
  TARGET_FEE_COVERAGE,
  TradeMemo,
  TradeResult,
  TradeState,
} from "../lib/index";
import { PriceProvider } from "./providers/PriceProvider";
import { TradesDao } from "./dao/Trades";
import { ConfigDao } from "./dao/Config";
import { isNode } from "browser-or-node";
import {
  type PluginResult,
  type Signal,
  SignalType,
  type TraderPlugin,
} from "./traders/plugin/api";
import { DefaultStore } from "./Store";
import { CandidatesDao } from "./dao/Candidates";
import { Binance } from "./Binance";
import { MarketDataDao } from "./dao/MarketData";
import { MarketInfoProvider } from "./providers/MarketInfoProvider";

export class TradeManager {
  #config: Config;
  #canInvest = 0;
  #balance = 0;
  #optimalInvestRatio = 0;

  static default(): TradeManager {
    const configDao = new ConfigDao(DefaultStore);
    const exchange = new Binance(configDao);
    const statistics = new Statistics(DefaultStore);
    const tradesDao = new TradesDao(DefaultStore);
    const candidatesDao = new CandidatesDao(DefaultStore);
    const priceProvider = PriceProvider.default();
    const marketInfoProvider = new MarketInfoProvider(
      new MarketDataDao(DefaultStore),
      candidatesDao,
      global.TradingHelperLibrary,
    );
    return new TradeManager(
      priceProvider,
      tradesDao,
      candidatesDao,
      configDao,
      exchange,
      statistics,
      global.TradingHelperLibrary,
      marketInfoProvider,
    );
  }

  constructor(
    private readonly priceProvider: PriceProvider,
    private readonly tradesDao: TradesDao,
    private readonly candidatesDao: ICandidatesDao,
    private readonly configDao: ConfigDao,
    private readonly exchange: IExchange,
    private readonly stats: Statistics,
    private readonly plugin: TraderPlugin,
    private readonly mktInfoProvider: MarketInfoProvider,
  ) {}

  syncPrices(): boolean {
    return this.priceProvider.update();
  }

  trade(step: number): void {
    this.#prepare();

    // First process !BUY state assets (some might get sold and free up $)
    this.tradesDao
      .getList()
      .filter((tm) => !tm.stateIs(TradeState.BUY))
      .sort(tmSorter)
      .forEach((tm) => {
        this.tradesDao.update(tm.getCoinName(), (t) => this.#checkTrade(t));
      });

    // Interim balances update after previous operations
    this.#updateBalances();

    const getMaxSignals = this.#config.ViewOnly;
    // Run plugin to update candidates and also get buy signals

    let libResult: PluginResult = { advancedAccess: false, signals: [] };
    try {
      libResult = this.plugin.trade({
        prices: this.priceProvider.get(this.#config.StableCoin),
        stableCoin: this.#config.StableCoin,
        provideSignals: getMaxSignals
          ? Number.MAX_SAFE_INTEGER // when no trading enabled - provide all signals
          : this.#getMoneyToInvest() > 0
          ? this.#canInvest // or provide as many as can be bought for available $
          : 0,
        candidatesDao: this.candidatesDao,
        I: step,
      });
    } catch (e) {
      Log.info(`Failed to update candidates: ${e.message}`);
      throw e;
    }

    const { advancedAccess, signals } = libResult;

    if (advancedAccess !== this.#config.AdvancedAccess) {
      this.configDao.update((cfg) => {
        cfg.AdvancedAccess = advancedAccess;
        return cfg;
      });
    }

    this.#checkAutoStop(step);
    this.#handleBuySignals(signals);
  }

  buy(coin: CoinName): void {
    this.#prepare();
    const symbol = new ExchangeSymbol(coin, this.#config.StableCoin);
    const price = this.#getPrices(symbol)?.currentPrice;
    if (price) {
      this.#buyNow({
        coin,
        type: SignalType.Manual,
        support: price * 0.9,
      });
    } else {
      throw new Error(`Unknown coin ${coin}: no price information found`);
    }
    this.#updateBalances();
  }

  sell(coin: CoinName): void {
    this.#prepare();
    this.tradesDao.update(
      coin,
      (t) => this.#sell(t),
      () => {
        Log.info(`${coin} not found`);
        return null;
      },
    );
    this.#updateBalances();
  }

  sellAll(): void {
    this.#prepare();
    this.tradesDao.iterate((t) => this.#sell(t), TradeState.BOUGHT);
    this.#updateBalances();
  }

  sellChunk(coin: CoinName, chunkSize: number): void {
    this.#prepare();

    this.tradesDao.update(
      coin,
      (tm) => {
        const origTr = tm.tradeResult;
        const trChunk = tm.tradeResult.getChunk(chunkSize);
        tm.tradeResult = trChunk;

        const r = this.#sell(tm);

        if (!r.stateIs(TradeState.SOLD)) {
          Log.info(
            `Couldn't sell ${coin}, attempted chunk: ${trChunk.toString()}`,
          );
          return;
        }

        // Calculate actual remaining chunk size based on the actually sold chunk
        const remainingSize = 1 - r.tradeResult.soldQty / origTr.quantity;
        tm.tradeResult = origTr.getChunk(remainingSize);
        tm.setState(TradeState.BOUGHT);
        tm.deleted = false;
        return tm;
      },
      () => {
        Log.info(`${coin} not found in portfolio.`);
        return null;
      },
    );

    this.#updateBalances();
  }

  edit(coin: CoinName, qty: number, paid: number): void {
    const stableCoin = this.configDao.get().StableCoin;
    const symbol = new ExchangeSymbol(coin, stableCoin);

    const tr = new TradeResult(symbol);
    tr.paid = paid;
    tr.cost = paid;
    tr.commission = 0;
    tr.fromExchange = true;
    tr.setQuantity(qty);

    const tm = this.#produceNewTradeMemo(tr);

    if (!tm.currentPrice) {
      Log.info(
        `The current price of ${symbol} is unknown. Cannot edit/create this coin.`,
      );
      return;
    }

    this.tradesDao.update(
      coin,
      () => tm,
      () => tm,
    );

    Log.alert(`➕ Edited ${coin}`);
    Log.info(prettyPrintTradeMemo(tm));
  }

  import(coin: CoinName, qty?: number): void {
    if (!this.exchange.importTrade) {
      throw new Error(`Import is not supported by the exchange`);
    }

    const stableCoin = this.configDao.get().StableCoin;
    const symbol = new ExchangeSymbol(coin, stableCoin);
    const importedTrade = this.exchange.importTrade(symbol, qty);

    if (importedTrade.fromExchange) {
      const returnImportedTm = () => {
        const tm = this.#produceNewTradeMemo(importedTrade);
        Log.alert(`➕ Imported ${symbol.quantityAsset}`);
        Log.info(prettyPrintTradeMemo(tm));
        return tm;
      };
      this.tradesDao.update(
        symbol.quantityAsset,
        (t) => {
          if (t.currentValue) {
            Log.alert(
              `Import cancelled: ${t.getCoinName()} is already present.`,
            );
            return null;
          }
          return returnImportedTm();
        },
        returnImportedTm,
      );
    } else {
      Log.alert(
        `${symbol.quantityAsset} could not be imported: ${importedTrade.msg}`,
      );
    }
  }

  #produceNewTradeMemo(tr: TradeResult): TradeMemo {
    tr.lotSizeQty = this.exchange.quantityForLotStepSize(
      tr.symbol,
      tr.quantity,
    );
    const tm = new TradeMemo(tr);
    const ph = this.#getPrices(tr.symbol);
    tm.currentPrice = ph?.currentPrice;
    tm.setState(TradeState.BOUGHT);
    return tm;
  }

  #prepare(): void {
    this.#initStableBalance();
    this.#optimalInvestRatio = Math.max(
      this.#config.BudgetSplitMin,
      this.plugin.getOptimalInvestRatio(this.candidatesDao),
    );
    const trades = this.tradesDao.getList();
    const invested = trades.filter((t) => t.tradeResult.quantity).length;
    this.#canInvest = Math.max(1, this.#optimalInvestRatio - invested);
  }

  #checkAutoStop(step: number) {
    const { strength } = this.mktInfoProvider.get(step);
    const strengthAdjusted = f0(strength * 100);
    if (
      this.#config.TradingAutoStopped &&
      strengthAdjusted >= this.#config.MarketStrengthTargets.max
    ) {
      this.#config = this.configDao.update((c) => {
        c.TradingAutoStopped = false;
        return c;
      });
      Log.alert(
        `Market Strength has reached ${this.#config.MarketStrengthTargets.max}`,
      );
    }
    if (
      !this.#config.TradingAutoStopped &&
      strengthAdjusted < this.#config.MarketStrengthTargets.min
    ) {
      this.#config = this.configDao.update((c) => {
        c.TradingAutoStopped = true;
        return c;
      });
      Log.alert(
        `Market Strength has dropped below ${
          this.#config.MarketStrengthTargets.min
        }`,
      );
    }
  }

  #initStableBalance(): void {
    const initFn = (cfg) => {
      if (cfg.StableBalance === AUTO_DETECT && cfg.KEY && cfg.SECRET) {
        try {
          cfg.StableBalance = this.exchange.getBalance(cfg.StableCoin);
        } catch (e) {
          Log.alert(
            `⚠️ Couldn't read the initial ${cfg.StableCoin} balance. It was set to $0, you can change in the Settings.`,
          );
          // It should stop trying to get the balance if it failed. Setting it to 0 will do that.
          cfg.StableBalance = 0;
        }
        return cfg;
      }
    };
    this.#config = this.configDao.update(initFn);
    this.#balance = this.#config.StableBalance;
  }

  #reFetchFeesBudget(): void {
    if (this.#config.KEY && this.#config.SECRET) {
      try {
        const symbol = new ExchangeSymbol(BNB, this.#config.StableCoin);
        const price = this.#getPrices(symbol)?.currentPrice;
        this.#config.FeesBudget = this.exchange.getBalance(BNB) * price;
      } catch (e) {
        Log.alert(
          `⚠️ Couldn't update fees budget. It was reset to 0. Next attempt is after next trade or during balance auto-detect.`,
        );
        this.#config.FeesBudget = 0;
      }
    }
  }

  #updateBalances(): void {
    const balanceChanged = !!(this.#balance - this.#config.StableBalance);

    if (balanceChanged) {
      const maxRetries = 5;
      const retryIntervalMs = 1000;
      // To update diff we want retry a few times before giving up
      this.configDao.updateWithRetry(
        (config: Config): Config | undefined => {
          this.#config = config; // Memorize latest config
          const curDiff = this.#balance - this.#config.StableBalance;
          // Update balances only if the balance changed
          // Or if FeesBudget is not set
          if (curDiff) {
            this.#balance = Math.max(this.#config.StableBalance, 0) + curDiff;
            this.#config.StableBalance = this.#balance;
            Log.info(
              `Free ${this.#config.StableCoin} balance: $${f2(this.#balance)}`,
            );
            return this.#config;
          }
        },
        maxRetries,
        retryIntervalMs,
      );
    }

    if (balanceChanged) {
      // Refetch fees budget
      this.configDao.update((config: Config): Config | undefined => {
        this.#config = config;
        this.#reFetchFeesBudget();
        Log.info(`Fees budget: ~$${f2(this.#config.FeesBudget)}`);
        return config;
      });
    }

    // Replenish fees budget
    // Check if AutoReplenishFeesBudget is enabled
    if (balanceChanged && this.#config.AutoReplenishFees) {
      this.configDao.update((config: Config): Config | undefined => {
        this.#config = config;
        try {
          this.#replenishFeesBudget();
        } catch (e) {
          Log.alert(
            `ℹ️ "Replenish fees budget" feature was disabled. Check manually and re-enable if the issue is resolved.`,
          );
          this.#config.AutoReplenishFees = false;
          Log.error(e);
        }
        return this.#config;
      });
    }
  }

  #replenishFeesBudget(): void {
    if (this.#balance <= MIN_BUY) return;

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
    const budgetNeeded = Math.floor(total * BNBFee * 2 * (target - curCover));

    if (this.#balance - budgetNeeded < MIN_BUY) {
      Log.info(
        `Fees budget cannot be replenished to cover ~${target} trades as free balance is not enough. It needs at least $${f2(
          budgetNeeded + MIN_BUY,
        )}.`,
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
        feesBudget,
      )}, added: ${tr.quantity} BNB, now: $${f2(this.#config.FeesBudget)}.`,
    );
    Log.debug({
      feesBudget,
      freeBalance: this.#balance,
      assetsValue,
      curCover,
      budgetNeeded,
    });
  }

  #handleBuySignals(signals: Signal[]) {
    if (this.#config.ViewOnly || this.#config.TradingAutoStopped) {
      signals
        .filter((s) => s.type === SignalType.Buy)
        .forEach(({ coin, support }) => {
          const symbol = new ExchangeSymbol(coin, this.#config.StableCoin);
          const ph = this.#getPrices(symbol);
          // Send signal email only if trading is not auto-stopped.
          if (!this.#config.TradingAutoStopped) {
            Log.alert(
              `${coin} - BUY signal. Current price: ${ph.currentPrice} | Support price: ${support}. Disable View-Only mode to buy automatically.`,
            );
          }
        });
      return;
    }

    signals
      .filter((s) => {
        const isBuy = s.type === SignalType.Buy;
        const isNotFeeCoin = s.coin !== BNB;
        const isNew = !this.tradesDao.getAll()[s.coin]?.currentValue;
        return isBuy && isNotFeeCoin && isNew;
      })
      // For back-testing, sort by name to ensure tests consistency
      // For production, randomizing the order to avoid biases
      .sort(signalSorter)
      .forEach((r) => {
        this.#buyNow(r);
        this.#updateBalances();
      });
  }

  #checkTrade(tm: TradeMemo): TradeMemo {
    this.#pushNewPrice(tm);

    tm.ttl = isFinite(tm.ttl) ? tm.ttl + 1 : 0;

    if (tm.stateIs(TradeState.BOUGHT)) {
      this.#processBoughtState(tm);
    }

    if (tm.stateIs(TradeState.SOLD)) {
      this.#processSoldState(tm);
    }

    // take action after processing
    if (tm.stateIs(TradeState.SELL)) {
      this.#sell(tm);
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
    if (!tm.currentPrice) {
      Log.alert(
        `⚠️ ${tm.tradeResult.symbol}: current price is unknown. If problem persists - please, trade the asset manually on the exchange.`,
      );
      return;
    }

    tm.tradeResult.lotSizeQty =
      tm.tradeResult.lotSizeQty ||
      this.exchange.quantityForLotStepSize(
        tm.tradeResult.symbol,
        tm.tradeResult.quantity,
      );

    if (!this.#config.SmartExit) {
      // If smart exit is disabled, we should return here
      return;
    }

    // This will init fields, or just use current values
    // Also, reset levels periodically
    if (!tm.highestPrice || !tm.lowestPrice || tm.ttl % 360 === 0) {
      tm.highestPrice = tm.currentPrice;
      tm.lowestPrice = floorToOptimalGrid(
        tm.currentPrice,
        this.exchange.getPricePrecision(tm.tradeResult.symbol),
      ).result;
    }

    if (tm.currentPrice < tm.support) {
      Log.info(
        `Selling as the current price ${tm.currentPrice} is below the support price ${tm.support}}`,
      );
      tm.setState(TradeState.SELL);
      return;
    }

    if (tm.isAutoTrade() && this.#config.TradingAutoStopped) {
      Log.info(`Selling as trading auto-stop activated.`);
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

  #getImbalance(tm: TradeMemo): { imbalance: number; precision: number } {
    // TODO: split into two functions

    const symbol = tm.tradeResult.symbol;
    const symbolInfo = this.plugin.getBinanceSymbolInfo(symbol);
    if (symbolInfo?.status !== SymbolStatus.TRADING) {
      this.configDao.update((config) => {
        config.SmartExit = false;
        this.#config = config;
        return config;
      });
      Log.alert(
        `⚠️ ${symbol} is not trading on Binance Spot, current status: ${symbolInfo?.status}`,
      );
      Log.alert(
        `⚠️ Smart-exit was disabled. Please, resolve the problem with ${symbol} manually using API console and than re-enable Smart-exit.`,
      );
      throw new Error(`Couldn't check imbalance for ${symbol}`);
    }

    const precision = symbolInfo?.precision;
    const imbalance = this.plugin.getImbalance(
      tm.getCoinName(),
      this.candidatesDao.get(tm.getCoinName()),
    );
    tm.supplyDemandImbalance = imbalance;
    return { precision, imbalance };
  }

  #pushNewPrice(tm: TradeMemo): void {
    const symbol = new ExchangeSymbol(
      tm.getCoinName(),
      this.#config.StableCoin,
    );
    const priceHolder = this.#getPrices(symbol);

    if (isNode && !priceHolder?.currentPrice) {
      // Only for back-testing, force selling this asset
      // The back-testing exchange mock will use the previous price
      this.#sell(tm);
      return;
    }

    if (priceHolder?.currentPrice) {
      tm.currentPrice = priceHolder.currentPrice;
      tm.priceMove = priceHolder.getPriceMove();
    } else if (tm.tradeResult.quantity) {
      // no price available, but we have quantity, which means we bought something earlier
      Log.alert(
        `Exchange does not have price for ${symbol}. Try another Stable Coin in Settings.`,
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

  #buyNow(signal: Signal): TradeMemo | undefined {
    const money = this.#getMoneyToInvest();
    if (money <= 0) {
      Log.info(`ℹ️ Can't buy ${signal.coin} - not enough balance`);
      return;
    }

    const symbol = new ExchangeSymbol(signal.coin, this.#config.StableCoin);
    const newTm = new TradeMemo(new TradeResult(symbol));
    newTm.setSignalMetadata(signal);
    newTm.setState(TradeState.BUY);

    this.tradesDao.update(
      signal.coin,
      (curTm) => {
        if (curTm.currentValue) {
          Log.info(`ℹ️ Can't buy ${signal.coin} - already in portfolio`);
        } else {
          return this.#buy(newTm, money);
        }
      },
      () => this.#buy(newTm, money),
    );

    return newTm;
  }

  #buy(tm: TradeMemo, cost: number): TradeMemo {
    const symbol = tm.tradeResult.symbol;
    const tradeResult = this.exchange.marketBuy(symbol, cost);
    if (tradeResult.fromExchange) {
      // any actions should not affect changing the state to BOUGHT in the end
      try {
        this.#canInvest = Math.max(0, this.#canInvest - 1);
        this.#balance -= tradeResult.paid;
        // join existing trade result quantity, commission, paid price, etc. with the new one
        tm.joinWithNewTrade(tradeResult);
        this.#processBuyFee(tradeResult);
        Log.info(
          `${tm.getCoinName()} quantity: ${
            tradeResult.quantity
          }, average price: $${f8(tm.tradeResult.avgPrice)}`,
        );
        Log.debug(tm);
      } catch (e) {
        Log.error(e);
      } finally {
        tm.ttl = 0;
        tm.currentPrice = this.#getPrices(symbol).currentPrice;
        tm.setState(TradeState.BOUGHT);
        this.#processBoughtState(tm);
      }
    } else {
      Log.debug(tradeResult);
      Log.debug(tm);
      tm.resetState();
      Log.alert(
        `⚠️ An issue happened while buying ${symbol}: ${tradeResult.msg}`,
      );
    }
    return tm;
  }

  #sell(tm: TradeMemo): TradeMemo {
    if (tm.tradeResult.quantity <= 0) {
      Log.alert(
        `⚠️ Can't sell ${tm.getCoinName()}. Current value is 0. The asset will be removed.`,
      );
      tm.resetState();
      return tm;
    }

    const entry = tm.tradeResult;
    const coin = tm.getCoinName();
    const symbol = new ExchangeSymbol(coin, this.#config.StableCoin);
    const exit = this.exchange.marketSell(symbol, entry.quantity);
    if (exit.fromExchange) {
      // any actions should not affect changing the state to SOLD in the end
      try {
        this.#canInvest = Math.min(
          this.#optimalInvestRatio,
          this.#canInvest + 1,
        );
        this.#balance += exit.gained;
        const fee = this.#processSellFee(entry, exit);
        const profit = exit.gained - entry.paid - fee;
        const profitPercentage = 100 * (profit / entry.paid);

        exit.paid = entry.paid + fee;

        Log.alert(
          `ℹ️ Gained: $${f2(exit.gained)} | ${
            profit >= 0 ? `Profit` : `Loss`
          }: $${f2(profit)} (${f2(profitPercentage)}%)`,
        );

        // Alert the following CSV string:
        // Entry Date,Coin/Token,Invested,Quantity,Entry Price,Exit Date,Exit Price,Gained,% Profit/Loss
        const exitDate = new Date().toLocaleDateString();
        // Derive entry date using ttl minutes
        const entryDate = new Date(
          new Date().getTime() - tm.ttl * 60 * 1000,
        ).toLocaleDateString();
        const precision = this.#getPrices(symbol).precision;
        const entryPrice = floor(entry.avgPrice, precision);
        const exitPrice = floor(exit.avgPrice, precision);
        Log.info(
          `<table><tr><th>Entry Date</th><th>Coin/Token</th><th>Invested</th><th>Quantity</th><th>Entry Price</th><th>Exit Date</th><th>Exit Price</th><th>Gained</th><th>% Profit/Loss</th></tr><tr><td>${entryDate}</td><td>${coin}</td><td>$${f2(
            entry.paid,
          )}</td><td>${
            entry.quantity
          }</td><td>$${entryPrice}</td><td>${exitDate}</td><td>$${exitPrice}</td><td>$${f2(
            exit.gained,
          )}</td><td>${f2(profitPercentage)}%</td></tr></table>`,
        );

        this.#updatePLStatistics(symbol.priceAsset as StableUSDCoin, profit);
      } catch (e) {
        Log.error(e);
      } finally {
        tm.tradeResult = exit;
        Log.debug(tm);
        tm.setState(TradeState.SOLD);
        tm.deleted = isNode;
      }
    } else {
      Log.debug(exit);
      Log.debug(tm);
      tm.setState(TradeState.BOUGHT);
      Log.alert(`⚠️ An issue happened while selling ${symbol}: ${exit}`);
    }

    return tm;
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
      new ExchangeSymbol(BNB, this.#config.StableCoin),
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
          `After paying fees, there is no more ${BNB} asset remaining and it is being removed from the portfolio.`,
        );
        tm.deleted = true;
        return tm;
      }

      // Set remaining BNB asset qty.
      // The asset BNB profit/loss correctly reflects "losses" due to paid fees.
      tm.tradeResult.setQuantity(remainingQty);
      Log.alert(
        `Remaining ${BNB} asset quantity was reduced after paying the trade fees.`,
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
    const nextLowPrice = tm.currentPrice * 0.995;
    tm.lowestPrice = floorToOptimalGrid(nextLowPrice, precision).result;

    const downMultiplier = 6;
    const threshold = tm.imbalanceThreshold(downMultiplier);
    if (imbalance < threshold) {
      Log.info(
        `Selling at price going down, as the current demand ${f0(
          imbalance * 100,
        )}% is below the required threshold ${f0(threshold * 100)}%`,
      );
      tm.setState(TradeState.SELL);
    }
  }

  #handleHigherHigh(tm: TradeMemo): void {
    const { imbalance, precision } = this.#getImbalance(tm);

    const nextHighPrice = tm.currentPrice * 1.005;
    // Set new highest price little higher than the current
    tm.highestPrice = floorToOptimalGrid(nextHighPrice, precision).result;

    const upMultiplier = 4;
    const threshold = tm.imbalanceThreshold(upMultiplier);
    const reqThreshold = Math.min(0.6, threshold);
    if (imbalance < reqThreshold) {
      Log.info(
        `Selling at price going up, as the current demand ${f0(
          imbalance * 100,
        )}% is below the required threshold ${f0(threshold * 100)}%`,
      );
      tm.setState(TradeState.SELL);
    }
  }
}
