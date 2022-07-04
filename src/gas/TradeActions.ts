import { DefaultStore } from "./Store"
import {
  ExchangeSymbol,
  IPriceProvider,
  StableUSDCoin,
  TradeMemo,
  TradeResult,
  TradeState,
} from "../lib"
import { Exchange } from "./Exchange"
import { PriceProvider } from "./PriceProvider"
import { CacheProxy } from "./CacheProxy"
import { TradesDao } from "./dao/Trades"
import { ConfigDao } from "./dao/Config"

export class TradeActions {
  private readonly stableCoin: StableUSDCoin
  private readonly priceProvider: IPriceProvider
  private readonly tradesDao: TradesDao

  static default(): TradeActions {
    const config = new ConfigDao(DefaultStore).get()
    const exchange = new Exchange(config.KEY, config.SECRET)
    return new TradeActions(
      new TradesDao(DefaultStore),
      config.StableCoin,
      PriceProvider.getInstance(exchange, CacheProxy),
    )
  }

  constructor(tradesDao: TradesDao, stableCoin: StableUSDCoin, priceProvider: IPriceProvider) {
    this.stableCoin = stableCoin
    this.priceProvider = priceProvider
    this.tradesDao = tradesDao
  }

  buy(coinName: string): void {
    const stableCoin = this.stableCoin
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
