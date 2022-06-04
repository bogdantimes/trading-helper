import { DefaultStore, IStore } from "./Store"
import { ExchangeSymbol, IPriceProvider, TradeMemo, TradeResult, TradeState } from "trading-helper-lib"
import { Exchange } from "./Exchange"
import { PriceProvider } from "./PriceProvider"
import { CacheProxy } from "./CacheProxy"

export class TradeActions {
  private readonly store: IStore
  private readonly priceProvider: IPriceProvider

  static default(): TradeActions {
    const exchange = new Exchange(DefaultStore.getConfig())
    return new TradeActions(DefaultStore, new PriceProvider(exchange, CacheProxy))
  }

  private constructor(store: IStore, priceProvider: IPriceProvider) {
    this.store = store
    this.priceProvider = priceProvider
  }

  buy(coinName: string): void {
    const stableCoin = this.store.getConfig().StableCoin
    const symbol = new ExchangeSymbol(coinName, stableCoin)
    this.store.changeTrade(
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
    this.store.changeTrade(coinName, (trade) => {
      if (trade.stateIs(TradeState.BOUGHT)) {
        trade.setState(TradeState.SELL)
      }
      return trade
    })
  }

  setHold(coinName: string, value: boolean): void {
    this.store.changeTrade(coinName, (trade) => {
      trade.hodl = !!value
      return trade
    })
  }

  drop(coinName: string): void {
    this.store.changeTrade(coinName, (trade) => {
      trade.deleted = true
      return trade
    })
  }

  cancel(coinName: string): void {
    this.store.changeTrade(coinName, (trade) => {
      trade.resetState()
      return trade
    })
  }

  replace(coinName: string, newTrade: TradeMemo): void {
    this.store.changeTrade(
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
