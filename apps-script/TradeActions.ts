import {DefaultStore} from "./Store";
import {TradeMemo, TradeState} from "./TradeMemo";
import {ExchangeSymbol, TradeResult} from "./TradeResult";

export class TradeActions {

  static buy(coinName: string): void {
    const symbol = new ExchangeSymbol(coinName, DefaultStore.getConfig().StableCoin);
    const trade = DefaultStore.getTrade(symbol) || new TradeMemo(new TradeResult(symbol));
    trade.setState(TradeState.BUY);
    trade.tradeResult.symbol = symbol;
    DefaultStore.setTrade(trade);
  }

  static sell(coinName: string): void {
    const symbol = new ExchangeSymbol(coinName, DefaultStore.getConfig().StableCoin);
    const trade = DefaultStore.getTrade(symbol);
    if (trade) {
      trade.setState(TradeState.SELL);
      DefaultStore.setTrade(trade);
    }
  }

  static setHold(coinName: string, value: boolean): void {
    const symbol = new ExchangeSymbol(coinName, DefaultStore.getConfig().StableCoin);
    const trade = DefaultStore.getTrade(symbol);
    if (trade) {
      trade.hodl = !!value;
      DefaultStore.setTrade(trade);
    }
  }

  static drop(coinName: string): void {
    const symbol = new ExchangeSymbol(coinName, DefaultStore.getConfig().StableCoin);
    const trade = DefaultStore.getTrade(symbol);
    if (trade) {
      if (trade.stateIs(TradeState.SOLD) || trade.stateIs(TradeState.BUY)) {
        DefaultStore.deleteTrade(trade);
      } else {
        Log.error(new Error(`Cannot drop ${coinName} as it is not sold`));
      }
    }
  }

  static cancel(coinName: string): void {
    const symbol = new ExchangeSymbol(coinName, DefaultStore.getConfig().StableCoin);
    const trade = DefaultStore.getTrade(symbol);
    if (trade) {
      if (trade.tradeResult.quantity) {
        trade.setState(TradeState.BOUGHT);
        DefaultStore.setTrade(trade);
      } else if (trade.tradeResult.soldPrice) {
        trade.setState(TradeState.SOLD);
        DefaultStore.setTrade(trade);
      } else {
        DefaultStore.deleteTrade(trade);
      }
    }
  }

  static replace(coinName: string, value: TradeMemo): void {
    const symbol = new ExchangeSymbol(coinName, DefaultStore.getConfig().StableCoin);
    const trade = DefaultStore.getTrade(symbol);
    if (trade) {
      const updatedTrade = TradeMemo.copy(value);
      if (trade.getCoinName() != updatedTrade.getCoinName()) {
        // if symbol changed, delete the old one
        // and reset prices in the new one
        updatedTrade.prices = [0, 0, 0];
        updatedTrade.stopLimitPrice = 0;
        DefaultStore.deleteTrade(trade);
      }
      DefaultStore.setTrade(updatedTrade);
    }
  }
}
