import { DefaultStore } from "./Store"
import { ExchangeSymbol, TradeState } from "../shared-lib/types"
import { TradeMemo } from "../shared-lib/TradeMemo"
import { TradeResult } from "../shared-lib/TradeResult"

export class TradeActions {
  static buy(coinName: string): void {
    const symbol = new ExchangeSymbol(coinName, DefaultStore.getConfig().StableCoin)
    DefaultStore.changeTrade(
      coinName,
      (tm) => {
        tm.setState(TradeState.BUY)
        tm.tradeResult.symbol = symbol
        return tm
      },
      () => {
        const tm = new TradeMemo(new TradeResult(symbol))
        tm.setState(TradeState.BUY)
        return tm
      },
    )
  }

  static sell(coinName: string): void {
    DefaultStore.changeTrade(coinName, (trade) => {
      trade.setState(TradeState.SELL)
      return trade
    })
  }

  static setHold(coinName: string, value: boolean): void {
    DefaultStore.changeTrade(coinName, (trade) => {
      trade.hodl = !!value
      return trade
    })
  }

  static drop(coinName: string): void {
    DefaultStore.changeTrade(coinName, (trade) => {
      trade.deleted = true
      return trade
    })
  }

  static cancel(coinName: string): void {
    DefaultStore.changeTrade(coinName, (trade) => {
      trade.resetState()
      return trade
    })
  }

  static replace(coinName: string, newTrade: TradeMemo): void {
    DefaultStore.changeTrade(coinName, (trade) => {
      if (trade.getCoinName() != newTrade.getCoinName()) {
        // if coin name changed reset prices
        newTrade.prices = [0, 0, 0]
        newTrade.stopLimitPrice = 0
      }
      return newTrade
    })
    if (coinName != newTrade.getCoinName()) {
      // if coin name changed delete old one
      TradeActions.drop(coinName)
    }
  }
}
