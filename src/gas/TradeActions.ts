import { DefaultStore, FirebaseStore } from "./Store"
import {
  Config,
  ExchangeSymbol,
  IPriceProvider,
  TradeMemo,
  TradeResult,
  TradeState,
} from "trading-helper-lib"
import { Exchange } from "./Exchange"
import { PriceProvider } from "./PriceProvider"
import { CacheProxy } from "./CacheProxy"
import { AssetsDao } from "./dao/Assets"
import { ConfigDao } from "./dao/Config"

export class TradeActions {
  private readonly config: Config
  private readonly priceProvider: IPriceProvider
  private readonly assetsDao: AssetsDao

  static default(): TradeActions {
    const config = new ConfigDao(DefaultStore, CacheProxy).get()
    const exchange = new Exchange(config)
    return new TradeActions(DefaultStore, config, new PriceProvider(exchange, CacheProxy))
  }

  private constructor(store: FirebaseStore, config: Config, priceProvider: IPriceProvider) {
    this.config = config
    this.priceProvider = priceProvider
    this.assetsDao = new AssetsDao(store, CacheProxy)
  }

  buy(coinName: string): void {
    const stableCoin = this.config.StableCoin
    const symbol = new ExchangeSymbol(coinName, stableCoin)
    this.assetsDao.update(
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
    this.assetsDao.update(coinName, (trade) => {
      if (trade.stateIs(TradeState.BOUGHT)) {
        trade.setState(TradeState.SELL)
      }
      return trade
    })
  }

  setHold(coinName: string, value: boolean): void {
    this.assetsDao.update(coinName, (trade) => {
      trade.hodl = !!value
      return trade
    })
  }

  drop(coinName: string): void {
    this.assetsDao.update(coinName, (trade) => {
      trade.deleted = true
      return trade
    })
  }

  cancel(coinName: string): void {
    this.assetsDao.update(coinName, (trade) => {
      trade.resetState()
      return trade
    })
  }

  replace(coinName: string, newTrade: TradeMemo): void {
    this.assetsDao.update(
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
