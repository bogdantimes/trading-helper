import {DefaultStore} from "./Store";
import {TradeMemo, TradeState} from "./TradeMemo";

export class TradesQueue {

  static getQueue() {
    return DefaultStore.get('Queue') || {LazyBuy: {}, LazySell: {}};
  }

  static buy(coinName: string): void {
    DefaultStore.set(`Queue/${coinName}`, 'buy');
  }

  static sell(coinName: string): void {
    DefaultStore.set(`Queue/${coinName}`, 'sell');
  }

  static flipHold(coinName: string): void {
    DefaultStore.set(`Queue/${coinName}`, 'flipHold');
  }

  static flush(): void {
    const store = DefaultStore;
    const config = store.getConfig();
    const queue = this.getQueue();

    Object.keys(queue).forEach(coinName => {
      try {
        const symbol = new ExchangeSymbol(coinName, config.PriceAsset);
        const action = queue[coinName];
        if (action === 'buy') {
          const trade = store.getTrade(symbol) || new TradeMemo(new TradeResult(symbol));
          trade.setState(TradeState.BUY);
          store.setTrade(trade);
        } else if (action === 'sell') {
          const trade = store.getTrade(symbol);
          if (trade) {
            trade.setState(TradeState.SELL);
            store.setTrade(trade);
          }
        } else if (action === 'flipHold') {
          const trade = store.getTrade(symbol);
          if (trade) {
            trade.hodl = !trade.hodl;
            store.setTrade(trade);
          }
        }
        delete queue[coinName];
      } catch (e) {
        Log.error(e)
      }
    });

    DefaultStore.set('Queue', queue);
  }
}
