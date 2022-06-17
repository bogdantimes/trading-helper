import { Statistics } from "../Statistics"
import { IExchange } from "../Exchange"
import { Log } from "../Common"
import {
  Coin,
  Config,
  ExchangeSymbol,
  f2,
  PriceHoldersMap,
  PriceMove,
  StableUSDCoin,
  TradeMemo,
  TradeResult,
  TradeState,
} from "trading-helper-lib"
import { CacheProxy } from "../CacheProxy"
import { PriceProvider } from "../PriceProvider"
import { TradesDao } from "../dao/Trades"
import { IStore } from "../Store"
import { ConfigDao } from "../dao/Config"

export class DefaultTrader {
  private readonly config: Config
  private readonly exchange: IExchange
  private readonly stats: Statistics
  private readonly prices: PriceHoldersMap
  private readonly trades: TradesDao

  /**
   * Used when {@link ProfitBasedStopLimit} is enabled.
   */
  private readonly totalProfit: number
  /**
   * Used when {@link ProfitBasedStopLimit} is enabled.
   */
  private readonly numberOfBoughtAssets: number

  constructor(store: IStore, exchange: IExchange, priceProvider: PriceProvider, stats: Statistics) {
    this.config = new ConfigDao(store).get()
    this.prices = priceProvider.get(this.config.StableCoin)
    this.exchange = exchange
    this.stats = stats
    this.trades = new TradesDao(store)

    if (this.config.ProfitBasedStopLimit) {
      this.totalProfit = stats.getAll().TotalProfit
      this.numberOfBoughtAssets = this.trades.getList(TradeState.BOUGHT).length
    }
  }

  tickerCheck(tm: TradeMemo): TradeMemo {
    this.pushNewPrice(tm)

    if (tm.stateIs(TradeState.BOUGHT)) {
      this.processBoughtState(tm)
    } else if (tm.stateIs(TradeState.SOLD)) {
      this.processSoldState(tm)
    }

    const priceMove = tm.getPriceMove()

    // take action after processing
    if (tm.stateIs(TradeState.SELL) && priceMove < PriceMove.UP) {
      // sell if price does not go up anymore
      // this allows to wait if price continues to go up
      this.sell(tm)
    } else if (tm.stateIs(TradeState.BUY) && priceMove > PriceMove.DOWN) {
      // buy only if price stopped going down
      // this allows to wait if price continues to fall
      this.buy(tm, this.config.BuyQuantity)
    }
    return tm
  }

  private processSoldState(tm: TradeMemo): void {
    if (!this.config.SwingTradeEnabled) {
      return
    }
    // Swing trade enabled.
    // Checking if price dropped below max observed price minus x2 profit limit percentage,
    // and we can buy again
    const symbol = tm.tradeResult.symbol
    const priceDropped = tm.currentPrice < tm.maxObservedPrice * (1 - this.config.ProfitLimit * 2)
    if (priceDropped) {
      Log.alert(`ℹ️ ${symbol} will be bought again as price dropped sufficiently`)
      tm.setState(TradeState.BUY)
    }
  }

  private processBoughtState(tm: TradeMemo): void {
    this.updateStopLimit(tm)

    if (tm.hodl) return

    if (tm.stopLimitCrossedDown()) {
      Log.alert(`ℹ️ ${tm.getCoinName()} stop limit crossed down at ${tm.currentPrice}`)
      this.config.SellAtStopLimit && tm.setState(TradeState.SELL)
    } else if (tm.profitLimitCrossedUp(this.config.ProfitLimit)) {
      Log.alert(`ℹ️ ${tm.getCoinName()} profit limit crossed up at ${tm.currentPrice}`)
      this.config.SellAtProfitLimit && tm.setState(TradeState.SELL)
    } else if (tm.entryPriceCrossedUp()) {
      // Log.alert(`ℹ️ ${tm.getCoinName()} entry price crossed up at ${tm.currentPrice}`)
    }
  }

  private updateStopLimit(tm: TradeMemo) {
    if (this.config.ProfitBasedStopLimit) {
      const allowedLossPerAsset = this.totalProfit / this.numberOfBoughtAssets
      tm.stopLimitPrice = (tm.tradeResult.cost - allowedLossPerAsset) / tm.tradeResult.quantity
    } else if (!tm.stopLimitPrice || tm.getPriceMove() > PriceMove.NEUTRAL) {
      const newStopLimit = tm.currentPrice * (1 - this.config.StopLimit)
      tm.stopLimitPrice = Math.max(tm.stopLimitPrice, newStopLimit)
    }
  }

  private forceUpdateStopLimit(tm: TradeMemo) {
    tm.stopLimitPrice = 0
    this.updateStopLimit(tm)
  }

  private pushNewPrice(tm: TradeMemo): void {
    const priceHolder = this.prices[tm.getCoinName()]
    if (priceHolder) {
      tm.pushPrice(priceHolder.currentPrice)
    } else if (tm.tradeResult.quantity) {
      // no price available, but we have quantity, which means we bought something earlier
      throw Error(`Exchange does not have price for ${tm.getCoinName()}${this.config.StableCoin}`)
    } else {
      // no price available, and no quantity, which means we haven't bought anything yet
      // could be a non-existing symbol, or not yet published in the exchange
      Log.info(`Exchange does not have price for ${tm.getCoinName()}${this.config.StableCoin}`)
    }
  }

  private buy(tm: TradeMemo, cost: number): void {
    const symbol = tm.tradeResult.symbol
    const tradeResult = this.exchange.marketBuy(symbol, cost)
    if (tradeResult.fromExchange) {
      // any actions should not affect changing the state to BOUGHT in the end
      try {
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
      }
    } else {
      Log.alert(`${symbol.quantityAsset} could not be bought: ${tradeResult}`)
      Log.debug(tm)
      tm.resetState()
    }
  }

  private sell(memo: TradeMemo): void {
    const symbol = new ExchangeSymbol(memo.tradeResult.symbol.quantityAsset, this.config.StableCoin)
    const tradeResult = this.exchange.marketSell(symbol, memo.tradeResult.quantity)
    if (tradeResult.fromExchange) {
      // any actions should not affect changing the state to SOLD in the end
      try {
        const fee = this.processSellFee(memo, tradeResult)
        const profit = f2(tradeResult.gained - memo.tradeResult.paid - fee)
        const profitPercentage = f2(100 * (profit / memo.tradeResult.paid))

        Log.alert(`ℹ️ ${profit >= 0 ? `Profit` : `Loss`}: ${profit} (${profitPercentage}%)`)

        tradeResult.profit = profit
        this.updatePLStatistics(symbol.priceAsset, profit)
      } catch (e) {
        Log.error(e)
      } finally {
        memo.tradeResult = tradeResult
        Log.debug(memo)
        memo.setState(TradeState.SOLD)
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

    if (memo.stateIs(TradeState.SOLD) && this.config.AveragingDown) {
      try {
        this.averageDown(tradeResult)
      } catch (e) {
        Log.error(e)
      }
    }
  }

  private averageDown(tradeResult: TradeResult) {
    // all gains are reinvested to most unprofitable asset
    // find a trade with the lowest profit percentage
    const byProfitPercentDesc = (t1, t2) => (t1.profitPercent() < t2.profitPercent() ? -1 : 1)
    const lowestPLTrade = this.trades
      .getList(TradeState.BOUGHT)
      .filter((t) => t.getCoinName() != tradeResult.symbol.quantityAsset)
      .sort(byProfitPercentDesc)[0]
    if (lowestPLTrade && lowestPLTrade.profit() < 0) {
      Log.alert(`ℹ️ Averaging down is enabled`)
      Log.alert(
        `All gains from selling ${tradeResult.symbol} are being invested to ${lowestPLTrade.tradeResult.symbol}`,
      )
      this.trades.update(lowestPLTrade.getCoinName(), (tm) => {
        this.buy(tm, tradeResult.gained)
        return tm
      })
    }
  }

  private updatePLStatistics(gainedCoin: string, profit: number): void {
    if (StableUSDCoin[gainedCoin]) {
      this.stats.addProfit(profit)
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
    const bnbPriceHolder = this.prices[`BNB`]
    return bnbPriceHolder ? commission * bnbPriceHolder.currentPrice : 0
  }

  private updateBNBBalance(quantity: number): boolean {
    let updated = false
    this.trades.update(`BNB`, (tm) => {
      // Changing only quantity, but not cost. This way the BNB amount is reduced, but the paid amount is not.
      // As a result, the BNB profit/loss correctly reflects losses due to paid fees.
      tm.tradeResult.addQuantity(quantity, 0)
      Log.alert(`BNB balance updated by ${quantity}`)
      updated = true
      return tm
    })
    return updated
  }

  updateStableCoinsBalance() {
    const stableCoins = []
    Object.keys(StableUSDCoin).forEach((coin) => {
      const balance = this.exchange.getFreeAsset(coin)
      balance && stableCoins.push(new Coin(coin, balance))
    })
    CacheProxy.put(CacheProxy.StableCoins, JSON.stringify(stableCoins))
  }
}
