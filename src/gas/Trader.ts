import { Statistics } from "./Statistics"
import { DefaultStore, IStore } from "./Store"
import { IExchange } from "./Exchange"
import { PriceAnomaly, PriceAnomalyChecker } from "./PriceAnomalyChecker"
import { Log } from "./Common"
import {
  Coin,
  Config,
  ExchangeSymbol,
  f2,
  PriceHoldersMap,
  StableUSDCoin,
  TradeMemo,
  TradeResult,
  TradeState,
} from "trading-helper-lib"
import { CacheProxy } from "./CacheProxy"
import { PriceProvider } from "./PriceProvider"

export class V2Trader {
  private readonly store: IStore
  private readonly config: Config
  private readonly exchange: IExchange
  private readonly stats: Statistics
  private readonly prices: PriceHoldersMap

  /**
   * Used when {@link ProfitBasedStopLimit} is enabled.
   */
  private readonly totalProfit: number
  /**
   * Used when {@link ProfitBasedStopLimit} is enabled.
   */
  private readonly numberOfBoughtAssets: number

  constructor(store: IStore, exchange: IExchange, priceProvider: PriceProvider, stats: Statistics) {
    this.store = store
    this.config = store.getConfig()
    this.prices = priceProvider.get(this.config.StableCoin)
    this.exchange = exchange
    this.stats = stats

    if (this.config.ProfitBasedStopLimit) {
      this.totalProfit = stats.getAll().TotalProfit
      this.numberOfBoughtAssets = store.getTradesList(TradeState.BOUGHT).length
    }
  }

  tickerCheck(tm: TradeMemo): TradeMemo {
    if (new Coin(tm.getCoinName()).isStable()) {
      // Remove stable coins from the list of coins to check
      tm.deleted = true
      return tm
    }

    this.pushNewPrice(tm)

    const result = PriceAnomalyChecker.check(tm, this.config.PriceAnomalyAlert)
    if (result === PriceAnomaly.DUMP && tm.stateIs(TradeState.BOUGHT) && this.config.BuyDumps) {
      Log.alert(`ℹ️ Buying price dumps is enabled: more ${tm.getCoinName()} will be bought.`)
      tm.setState(TradeState.BUY)
    }

    if (tm.stateIs(TradeState.BOUGHT)) {
      this.processBoughtState(tm)
    } else if (tm.stateIs(TradeState.SOLD)) {
      this.processSoldState(tm)
    }

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
    } else {
      Log.info(`${symbol} price has not dropped sufficiently, skipping swing trade`)
    }
  }

  private processBoughtState(tm: TradeMemo): void {
    this.updateStopLimit(tm)

    if (tm.hodl) return

    if (tm.stopLimitCrossedDown()) {
      Log.alert(`📉 ${tm.getCoinName()} stop limit crossed down at ${tm.currentPrice}`)
      this.config.SellAtStopLimit && tm.setState(TradeState.SELL)
    } else if (tm.profitLimitCrossedUp(this.config.ProfitLimit)) {
      Log.alert(`📈 ${tm.getCoinName()} profit limit crossed up at ${tm.currentPrice}`)
      this.config.SellAtProfitLimit && tm.setState(TradeState.SELL)
    } else if (tm.entryPriceCrossedUp()) {
      Log.alert(`ℹ️ ${tm.getCoinName()} entry price crossed up at ${tm.currentPrice}`)
    }
  }

  private updateStopLimit(tm: TradeMemo) {
    if (this.config.ProfitBasedStopLimit) {
      const allowedLossPerAsset = this.totalProfit / this.numberOfBoughtAssets
      tm.stopLimitPrice = (tm.tradeResult.cost - allowedLossPerAsset) / tm.tradeResult.quantity
    } else if (!tm.stopLimitPrice || tm.priceGoesStrongUp()) {
      const newStopLimit = tm.currentPrice * (1 - this.config.StopLimit)
      tm.stopLimitPrice = Math.max(tm.stopLimitPrice, newStopLimit)
    }
  }

  private forceUpdateStopLimit(tm: TradeMemo) {
    tm.stopLimitPrice = 0
    this.updateStopLimit(tm)
  }

  private pushNewPrice(tm: TradeMemo): void {
    const symbol = tm.tradeResult.symbol
    const priceHolder = this.prices[symbol.quantityAsset]
    if (priceHolder) {
      tm.pushPrice(priceHolder.currentPrice)
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
    const symbol = tm.tradeResult.symbol
    const tradeResult = this.exchange.marketBuy(symbol, cost)
    if (tradeResult.fromExchange) {
      // any actions should not affect changing the state to BOUGHT in the end
      try {
        tm.joinWithNewTrade(tradeResult)
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
    const lowestPLTrade = this.store
      .getTradesList(TradeState.BOUGHT)
      .filter((t) => t.getCoinName() != tradeResult.symbol.quantityAsset)
      .sort(byProfitPercentDesc)[0]
    if (lowestPLTrade && lowestPLTrade.profit() < 0) {
      Log.alert(`ℹ️ Averaging down is enabled`)
      Log.alert(
        `All gains from selling ${tradeResult.symbol} are being invested to ${lowestPLTrade.tradeResult.symbol}`,
      )
      DefaultStore.changeTrade(lowestPLTrade.getCoinName(), (tm) => {
        this.buy(tm, tradeResult.gained)
        return tm
      })
    }
  }

  private updatePLStatistics(gainedCoin: string, profit: number): void {
    if (new Coin(gainedCoin).isStable()) {
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
    DefaultStore.changeTrade(`BNB`, (tm) => {
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
