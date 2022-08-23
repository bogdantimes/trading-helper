import { Statistics } from "./Statistics";
import { Exchange, IExchange } from "./Exchange";
import { Log } from "./Common";
import {
  CoinName,
  Config,
  ExchangeSymbol,
  f2,
  Key,
  PriceMove,
  PricesHolder,
  StableUSDCoin,
  TradeMemo,
  TradeResult,
  TradeState,
} from "../lib/index";
import { PriceProvider } from "./priceprovider/PriceProvider";
import { TradesDao } from "./dao/Trades";
import { ConfigDao, DefaultConfig } from "./dao/Config";
import { isNode } from "browser-or-node";
import { TradeAction, TraderPlugin } from "./traders/pro/api";
import { ChannelsDao } from "./dao/Channels";
import { DefaultStore } from "./Store";
import { CacheProxy } from "./CacheProxy";

export class TradeManager {
  #config: Config;
  #canInvest = 0;
  #balance = 0;

  static default(): TradeManager {
    const configDao = new ConfigDao(DefaultStore);
    const config = configDao.get();
    const exchange = new Exchange(config.KEY, config.SECRET);
    const statistics = new Statistics(DefaultStore);
    const tradesDao = new TradesDao(DefaultStore);
    const priceProvider = PriceProvider.default(exchange, CacheProxy);
    const channelsDao = new ChannelsDao(DefaultStore);
    return new TradeManager(
      priceProvider,
      tradesDao,
      configDao,
      channelsDao,
      exchange,
      statistics,
      global.TradingHelperLibrary
    );
  }

  constructor(
    readonly priceProvider: PriceProvider,
    private readonly tradesDao: TradesDao,
    private readonly configDao: ConfigDao,
    private readonly channelsDao: ChannelsDao,
    private readonly exchange: IExchange,
    private readonly stats: Statistics,
    private readonly plugin: TraderPlugin
  ) {}

  trade(): void {
    // Get current config
    this.#config = this.configDao.get();
    this.#initBalance();

    this.plugin
      .trade({
        config: this.#config,
        channelsDao: this.channelsDao,
        priceProvider: this.priceProvider,
      })
      .forEach(({ coin, action }) => {
        if (action === TradeAction.Buy) {
          this.#setBuyState(coin);
        } else if (action === TradeAction.Sell) {
          this.#setSellState(coin);
        }
      });

    // Randomize the order of trades to avoid biases
    const trades = this.tradesDao.getList().sort(() => Math.random() - 0.5);

    if (this.#config.InvestRatio > 0) {
      const inv = trades.filter(
        (t) =>
          t.tradeResult.quantity > 0 &&
          !this.#config.HODL.includes(t.getCoinName())
      );
      this.#canInvest = Math.max(0, this.#config.InvestRatio - inv.length);
    }

    const tms = [
      // First process existing trades (some might get sold and free up space to buy new ones)
      ...trades.filter((tm) => !tm.stateIs(TradeState.BUY)),
      // Now process those which were requested to buy
      ...trades.filter((tm) => tm.stateIs(TradeState.BUY)),
    ];
    tms.forEach((tm) => {
      try {
        this.tradesDao.update(tm.getCoinName(), (t) => this.#checkTrade(t));
      } catch (e) {
        Log.alert(`Failed to trade ${tm.getCoinName()}: ${e.message}`);
        Log.error(e);
      }
    });
    this.#persistBalance();
  }

  sellAll(keepHodls = true, sellNow = false): void {
    const hodls = keepHodls ? new ConfigDao(DefaultStore).get().HODL : [];
    this.tradesDao.iterate((tm) => {
      if (hodls.includes(tm.getCoinName())) {
        return null;
      }
      tm.resetState();
      if (tm.tradeResult.quantity > 0) {
        tm.setState(TradeState.SELL);
        sellNow && this.#sell(tm);
      }
      return tm;
    });
    this.#persistBalance();
  }

  #initBalance(): void {
    this.#balance = this.#config.StableBalance;
    if (this.#balance === -1) {
      this.#balance = this.exchange.getBalance(this.#config.StableCoin);
    }
  }

  #persistBalance(): void {
    const diff = this.#balance - this.#config.StableBalance;
    if (diff !== 0) {
      this.#config = this.configDao.get();
      this.#config.StableBalance += diff;
      this.#balance = this.#config.StableBalance;
      this.configDao.set(this.#config);
    }
  }

  #setBuyState(coinName: CoinName): void {
    const symbol = new ExchangeSymbol(coinName, this.#config.StableCoin);
    this.tradesDao.update(
      coinName,
      (tm) => {
        tm.setState(TradeState.BUY);
        tm.tradeResult.symbol = symbol;
        return tm;
      },
      () => {
        const tm = new TradeMemo(new TradeResult(symbol));
        tm.prices = this.priceProvider.get(this.#config.StableCoin)[
          tm.getCoinName()
        ]?.prices;
        tm.setState(TradeState.BUY);
        return tm;
      }
    );
  }

  #setSellState(coinName: string): void {
    this.tradesDao.update(coinName, (tm) => {
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
      const howMuch = this.#calculateQuantity(tm);
      if (howMuch > 0 && howMuch <= this.#balance) {
        this.#buy(tm, howMuch);
      } else {
        Log.info(
          `ℹ️ Can't buy ${tm.getCoinName()} - not enough balance or invest ratio would be exceeded`
        );
        tm.resetState();
      }
    }
    return tm;
  }

  #calculateQuantity(tm: TradeMemo): number {
    if (this.#config.InvestRatio <= 0) {
      return this.#config.BuyQuantity;
    }
    if (this.#canInvest <= 0 || tm.tradeResult.quantity > 0) {
      // Return 0 if we can't invest anymore or if we already bought this coin
      return 0;
    }
    return Math.max(
      DefaultConfig().BuyQuantity,
      Math.floor(this.#balance / this.#canInvest)
    );
  }

  private processBoughtState(tm: TradeMemo): void {
    this.updateStopLimit(tm);

    isFinite(tm.ttl) && tm.ttl++;

    if (this.#config.HODL.includes(tm.getCoinName())) return;

    if (tm.stopLimitCrossedDown()) {
      Log.alert(
        `ℹ️ ${tm.getCoinName()} stop limit crossed down at ${tm.currentPrice}`
      );
      this.#config.SellAtStopLimit && tm.setState(TradeState.SELL);
    } else if (tm.profitLimitCrossedUp(this.#config.ProfitLimit)) {
      Log.alert(
        `ℹ️ ${tm.getCoinName()} profit limit crossed up at ${tm.currentPrice}`
      );
    }

    if (
      this.#config.TTL &&
      isFinite(tm.ttl) &&
      tm.ttl > this.#config.TTL &&
      tm.profitPercent() > -3 &&
      tm.profitPercent() < 3
    ) {
      tm.setState(TradeState.SELL);
    }
  }

  private updateStopLimit(tm: TradeMemo): void {
    if (tm.stopLimitPrice === 0) {
      const ch = this.channelsDao.get(tm.getCoinName());
      tm.stopLimitPrice = ch[Key.MIN];
    } else {
      // The stop limit price is the price at which the trade will be sold if the price drops below it.
      // The stop limit price is calculated as follows:
      // 1. Get the last N prices and calculate the average price.
      // 2. Multiply the average price by K, where: 1 - StopLimit <= K <= 0.99,
      //    K -> 0.99 proportionally to the current profit.
      //    The closer the current profit to the ProfitLimit, the closer K is to 0.99.
      const SL = this.#config.ChannelSize;
      const PL = this.#config.ProfitLimit;
      const P = tm.profit() / tm.tradeResult.paid;
      const K = Math.min(0.99, 1 - SL + Math.max(0, (P * SL) / PL));

      const lastN = 3;
      const avePrice =
        tm.prices.slice(-lastN).reduce((a, b) => a + b, 0) / lastN;
      // new stop limit cannot be higher than current price
      const newStopLimit = Math.min(K * avePrice, tm.currentPrice);
      tm.stopLimitPrice = Math.max(tm.stopLimitPrice, newStopLimit);
    }
  }

  private forceUpdateStopLimit(tm: TradeMemo): void {
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
      } else if (!this.#config.HODL.includes(tm.getCoinName())) {
        this.#config.HODL.push(tm.getCoinName());
        Log.alert(
          `The ${tm.getCoinName()} asset is marked HODL. Please, resolve the issue manually.`
        );
      }
    } else {
      // no price available, and no quantity, which means we haven't bought anything yet
      // could be a non-existing symbol, or not yet published in the exchange
      Log.info(`Exchange does not have price for ${symbol}`);
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
        tm.prices = [tradeResult.price];
        // join existing trade result quantity, commission, paid price, etc. with the new one
        tm.joinWithNewTrade(tradeResult);
        // set the stop limit according to the current settings
        this.forceUpdateStopLimit(tm);
        this.processBuyFee(tradeResult);
        Log.alert(
          `${tm.getCoinName()} asset average price: ${tm.tradeResult.price}`
        );
        Log.debug(tm);
      } catch (e) {
        Log.error(e);
      } finally {
        tm.setState(TradeState.BOUGHT);
        tm.ttl = 0;
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
          this.#config.InvestRatio,
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
      this.#config.HODL.push(memo.getCoinName());
      memo.setState(TradeState.BOUGHT);
      Log.alert(
        `An issue happened while selling ${symbol}. The asset is marked HODL. Please, resolve it manually.`
      );
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
