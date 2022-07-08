import { DefaultStore } from "./Store"
import { ExchangeSymbol, IPriceProvider, TradeMemo, TradeResult, TradeState } from "../lib"
import { Exchange, IExchange } from "./Exchange"
import { PriceProvider } from "./PriceProvider"
import { CacheProxy } from "./CacheProxy"
import { TradesDao } from "./dao/Trades"
import { ConfigDao } from "./dao/Config"
import { DefaultTrader } from "./traders/DefaultTrader"
import { Statistics } from "./Statistics"

export class TradeActions {
  static default(): TradeActions {
    const configDao = new ConfigDao(DefaultStore)
    const config = configDao.get()
    const exchange = new Exchange(config.KEY, config.SECRET)
    const statistics = new Statistics(DefaultStore)
    const tradesDao = new TradesDao(DefaultStore)
    const priceProvider = PriceProvider.getInstance(exchange, CacheProxy)
    const defaultTrader = new DefaultTrader(
      tradesDao,
      configDao,
      exchange,
      priceProvider,
      statistics,
    )
    return new TradeActions(tradesDao, configDao, priceProvider, defaultTrader, exchange)
  }

  constructor(
    readonly tradesDao: TradesDao,
    readonly configDao: ConfigDao,
    readonly priceProvider: IPriceProvider,
    readonly defaultTrader: DefaultTrader,
    readonly exchange: IExchange,
  ) {}

  buy(coinName: string): void {
    const stableCoin = this.configDao.get().StableCoin
    const symbol = new ExchangeSymbol(coinName, stableCoin)
    this.tradesDao.update(
      coinName,
      (tm) => {
        tm.setState(TradeState.BUY)
        tm.tradeResult.symbol = symbol
        return tm
      },
      () => {
        const tm = new TradeMemo(new TradeResult(symbol))
        tm.prices = this.priceProvider.get(stableCoin)[tm.getCoinName()]?.prices
        tm.setState(TradeState.BUY)
        return tm
      },
    )
  }

  sell(coinName: string): void {
    this.tradesDao.update(coinName, (trade) => {
      if (trade.stateIs(TradeState.BOUGHT)) {
        trade.setState(TradeState.SELL)
      }
      return trade
    })
  }

  sellNow(coinName: string): void {
    this.defaultTrader.sellNow(coinName)
  }

  setHold(coinName: string, value: boolean): void {
    this.tradesDao.update(coinName, (trade) => {
      trade.hodl = !!value
      return trade
    })
  }

  drop(coinName: string): void {
    this.tradesDao.update(coinName, (trade) => {
      trade.deleted = true
      return trade
    })
  }

  cancel(coinName: string): void {
    this.tradesDao.update(coinName, (trade) => {
      trade.resetState()
      return trade
    })
  }

  replace(coinName: string, newTrade: TradeMemo): void {
    this.tradesDao.update(
      coinName,
      (trade) => {
        if (trade.getCoinName() != newTrade.getCoinName()) {
          // if coin name changed reset prices
          newTrade.prices = []
          newTrade.stopLimitPrice = 0
        }
        return newTrade
      },
      () => newTrade,
    )
    if (coinName != newTrade.getCoinName()) {
      // if coin name changed delete old one
      this.drop(coinName)
    }
  }
}
