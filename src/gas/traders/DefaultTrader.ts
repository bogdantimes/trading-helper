import { Statistics } from "../Statistics"
import { IExchange } from "../Exchange"
import { Log, StableCoins } from "../Common"
import {
  Coin,
  CoinName,
  Config,
  ExchangeSymbol,
  f2,
  IPriceProvider,
  IStore,
  PriceMove,
  PricesHolder,
  StableUSDCoin,
  TradeMemo,
  TradeResult,
  TradeState,
} from "../../lib"
import { PriceProvider } from "../PriceProvider"
import { TradesDao } from "../dao/Trades"
import { ConfigDao, DefaultConfig } from "../dao/Config"
import { isNode } from "browser-or-node"

export class DefaultTrader {
  readonly #tradesDao: TradesDao
  readonly #configDao: ConfigDao
  readonly #exchange: IExchange
  readonly #priceProvider: IPriceProvider
  readonly #stats: Statistics

  #config: Config
  /**
   * Used when {@link ProfitBasedStopLimit} is enabled.
   */
  #boughtStateCount = 0
  #canInvest = -1

  constructor(
    tradesDao: TradesDao,
    configDao: ConfigDao,
    exchange: IExchange,
    priceProvider: PriceProvider,
    stats: Statistics,
  ) {
    this.#priceProvider = priceProvider
    this.#exchange = exchange
    this.#stats = stats
    this.#tradesDao = tradesDao
    this.#configDao = configDao
  }

  trade(): void {
    // Get current config
    this.#config = this.#configDao.get()
    // Randomize the order of trades to avoid biases
    const trades = this.#tradesDao.getList().sort(() => Math.random() - 0.5)
    const bought = trades.filter((t) => t.stateIs(TradeState.BOUGHT))
    this.#boughtStateCount = bought.length

    if (this.#config.InvestRatio > 0) {
      const invested = bought.filter((tm) => !tm.hodl).length
      this.#canInvest = Math.max(0, this.#config.InvestRatio - invested)
    }

    trades.forEach((trade) => {
      try {
        this.#tradesDao.update(trade.getCoinName(), (tm) => this.#checkTrade(tm))
      } catch (e) {
        Log.alert(`Failed to trade ${trade.getCoinName()}: ${e.message}`)
        Log.error(e)
      }
    })
  }

  #checkTrade(tm: TradeMemo): TradeMemo {
    this.pushNewPrice(tm)

    if (tm.tradeResult.quantity > 0) {
      this.processBoughtState(tm)
    }

    const priceMove = tm.getPriceMove()

    // take action after processing
    if (tm.stateIs(TradeState.SELL) && (tm.stopLimitCrossedDown() || priceMove < PriceMove.UP)) {
      // sell if price stop limit crossed down
      // or the price does not go up anymore
      // this allows to wait if price continues to go up
      this.sell(tm)
    } else if (tm.stateIs(TradeState.BUY) && priceMove > PriceMove.DOWN) {
      // buy only if price stopped going down
      // this allows to wait if price continues to fall
      const howMuch = this.#calculateQuantity(tm)
      if (howMuch > 0) {
        this.buy(tm, howMuch)
      } else {
        Log.alert(`ℹ️ Can't buy ${tm.getCoinName()} - invest ratio would be exceeded`)
        tm.resetState()
      }
    }
    return tm
  }

  #calculateQuantity(tm: TradeMemo): number {
    if (this.#canInvest < 0) {
      return this.#config.BuyQuantity
    }
    if (this.#canInvest <= 0 || tm.tradeResult.quantity > 0) {
      // Return 0 if we can't invest anymore or if we already bought this coin
      return 0
    }
    const balance = this.#exchange.getBalance(tm.tradeResult.symbol.priceAsset)
    return Math.max(DefaultConfig().BuyQuantity, Math.floor(balance / this.#canInvest))
  }

  private processBoughtState(tm: TradeMemo): void {
    this.updateStopLimit(tm)

    isFinite(tm.ttl) && tm.ttl++

    if (tm.hodl) return

    if (tm.stopLimitCrossedDown()) {
      Log.alert(`ℹ️ ${tm.getCoinName()} stop limit crossed down at ${tm.currentPrice}`)
      this.#config.SellAtStopLimit && tm.setState(TradeState.SELL)
    } else if (tm.profitLimitCrossedUp(this.#config.ProfitLimit)) {
      Log.alert(`ℹ️ ${tm.getCoinName()} profit limit crossed up at ${tm.currentPrice}`)
      this.#config.SellAtProfitLimit && tm.setState(TradeState.SELL)
    }

    if (
      this.#config.TTL &&
      isFinite(tm.ttl) &&
      tm.ttl > this.#config.TTL &&
      tm.profitPercent() > 0.1 &&
      tm.profitPercent() < 5
    ) {
      tm.setState(TradeState.SELL)
    }
  }

  private updateStopLimit(tm: TradeMemo) {
    if (this.#config.ProfitBasedStopLimit) {
      const allowedLossPerAsset = this.#stats.totalProfit / this.#boughtStateCount
      tm.stopLimitPrice = (tm.tradeResult.cost - allowedLossPerAsset) / tm.tradeResult.quantity
    } else {
      // The stop limit price is the price at which the trade will be sold if the price drops below it.
      // The stop limit price is calculated as follows:
      // 1. Get the last N prices and calculate the average price.
      // 2. Multiply the average price by K, where: 1 - StopLimit <= K <= 0.99,
      //    K -> 0.99 proportionally to the current profit.
      //    The closer the current profit to the ProfitLimit, the closer K is to 0.99.
      const SL = this.#config.StopLimit
      const PL = this.#config.ProfitLimit
      const P = tm.profitPercent() / 100
      const K = Math.min(0.99, 1 - SL + Math.max(0, (P * SL) / PL))

      const lastN = 3
      const avePrice = tm.prices.slice(-lastN).reduce((a, b) => a + b, 0) / lastN
      // new stop limit cannot be higher than current price
      const newStopLimit = Math.min(K * avePrice, tm.currentPrice)
      tm.stopLimitPrice = Math.max(tm.stopLimitPrice, newStopLimit)
    }
  }

  private forceUpdateStopLimit(tm: TradeMemo) {
    tm.stopLimitPrice = 0
    this.updateStopLimit(tm)
  }

  private pushNewPrice(tm: TradeMemo): void {
    const priceHolder = this.#getPrices(tm.tradeResult.symbol)
    const symbol = `${tm.getCoinName()}${this.#config.StableCoin}`
    if (priceHolder) {
      tm.pushPrice(priceHolder.currentPrice)
    } else if (tm.tradeResult.quantity) {
      // no price available, but we have quantity, which means we bought something earlier
      Log.alert(`Exchange does not have price for ${symbol}.`)
      if (isNode) {
        // Only for back-testing, force selling this asset
        // The back-testing exchange mock will use the previous price
        this.sell(tm)
      } else if (!tm.hodl) {
        tm.hodl = true
        Log.alert(
          `The ${tm.getCoinName()} asset is marked HODL. Please, resolve the issue manually.`,
        )
      }
    } else {
      // no price available, and no quantity, which means we haven't bought anything yet
      // could be a non-existing symbol, or not yet published in the exchange
      Log.info(`Exchange does not have price for ${symbol}`)
    }
  }

  #getPrices(symbol: ExchangeSymbol): PricesHolder {
    return this.#priceProvider.get(symbol.priceAsset as StableUSDCoin)[symbol.quantityAsset]
  }

  private buy(tm: TradeMemo, cost: number): void {
    const symbol = tm.tradeResult.symbol
    const tradeResult = this.#exchange.marketBuy(symbol, cost)
    if (tradeResult.fromExchange) {
      // any actions should not affect changing the state to BOUGHT in the end
      try {
        this.#canInvest--
        // flatten out prices to make them not cross any limits right after the trade
        tm.prices = [tradeResult.price]
        // join existing trade result quantity, commission, paid price, etc. with the new one
        tm.joinWithNewTrade(tradeResult)
        // set the stop limit according to the current settings
        this.forceUpdateStopLimit(tm)
        this.processBuyFee(tradeResult)
        Log.alert(`${tm.getCoinName()} asset average price: ${tm.tradeResult.price}`)
        Log.debug(tm)
      } catch (e) {
        Log.error(e)
      } finally {
        tm.setState(TradeState.BOUGHT)
        tm.ttl = 0
      }
    } else {
      Log.alert(`${symbol.quantityAsset} could not be bought: ${tradeResult}`)
      Log.debug(tm)
      tm.resetState()
    }
  }

  sellNow(coinName: CoinName): void {
    this.#tradesDao.update(coinName, (trade) => {
      if (trade.stateIs(TradeState.BOUGHT)) {
        this.sell(trade)
      }
      return trade
    })
  }

  private sell(memo: TradeMemo): void {
    const symbol = new ExchangeSymbol(
      memo.tradeResult.symbol.quantityAsset,
      this.#config.StableCoin,
    )
    const tradeResult = this.#exchange.marketSell(symbol, memo.tradeResult.quantity)
    if (tradeResult.fromExchange) {
      // any actions should not affect changing the state to SOLD in the end
      try {
        this.#canInvest++
        const fee = this.processSellFee(memo, tradeResult)
        const profit = f2(tradeResult.gained - memo.tradeResult.paid - fee)
        const profitPercentage = f2(100 * (profit / memo.tradeResult.paid))

        Log.alert(`ℹ️ ${profit >= 0 ? `Profit` : `Loss`}: ${profit} (${profitPercentage}%)`)

        tradeResult.profit = profit
        this.updatePLStatistics(symbol.priceAsset as StableUSDCoin, profit)
      } catch (e) {
        Log.error(e)
      } finally {
        memo.tradeResult = tradeResult
        Log.debug(memo)
        memo.setState(TradeState.SOLD)
        memo.ttl = 0
      }
    } else {
      Log.debug(memo)
      memo.hodl = true
      memo.setState(TradeState.BOUGHT)
      Log.alert(
        `An issue happened while selling ${symbol}. The asset is marked HODL. Please, resolve it manually.`,
      )
      Log.alert(tradeResult.toString())
    }

    memo.deleted = memo.stateIs(TradeState.SOLD)
  }

  private updatePLStatistics(gainedCoin: StableUSDCoin, profit: number): void {
    if (StableUSDCoin[gainedCoin]) {
      this.#stats.addProfit(profit)
      Log.info(`P/L added to statistics: ` + profit)
    }
  }

  private processBuyFee(buyResult: TradeResult): void {
    if (this.updateBNBBalance(-buyResult.commission)) {
      // if fee paid by existing BNB asset balance, commission can be zeroed in the trade result
      buyResult.commission = 0
    }
  }

  private processSellFee(tm: TradeMemo, sellResult: TradeResult): number {
    if (this.updateBNBBalance(-sellResult.commission)) {
      // if fee paid by existing BNB asset balance, commission can be zeroed in the trade result
      sellResult.commission = 0
    }
    const buyFee = this.getBNBCommissionCost(tm.tradeResult.commission)
    const sellFee = this.getBNBCommissionCost(sellResult.commission)
    return buyFee + sellFee
  }

  private getBNBCommissionCost(commission: number): number {
    const bnbPriceHolder = this.#getPrices(new ExchangeSymbol(`BNB`, this.#config.StableCoin))
    return bnbPriceHolder ? commission * bnbPriceHolder.currentPrice : 0
  }

  private updateBNBBalance(quantity: number): boolean {
    let updated = false
    this.#tradesDao.update(`BNB`, (tm) => {
      // Changing only quantity, but not cost. This way the BNB amount is reduced, but the paid amount is not.
      // As a result, the BNB profit/loss correctly reflects losses due to paid fees.
      tm.tradeResult.addQuantity(quantity, 0)
      Log.alert(`BNB balance updated by ${quantity}`)
      updated = true
      return tm
    })
    return updated
  }

  updateStableCoinsBalance(store: IStore) {
    const stableCoins: any[] = []
    Object.keys(StableUSDCoin).forEach((coin) => {
      const balance = this.#exchange.getBalance(coin)
      balance && stableCoins.push(new Coin(coin, balance))
    })
    store.set(StableCoins, stableCoins)
  }
}
