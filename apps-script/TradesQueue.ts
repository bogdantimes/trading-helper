import {DefaultStore} from "./Store";
import {TradeMemo, TradeState} from "./TradeMemo";
import {ExchangeSymbol, TradeResult} from "./TradeResult";
import {CacheProxy} from "./CacheProxy";

export class TradesQueue {

  static getQueue() {
    const queueJson = CacheProxy.get('Queue');
    return queueJson ? JSON.parse(queueJson) : {};
  }

  static buy(coinName: string): void {
    const queue = this.getQueue();
    queue[coinName] = QueueAction.BUY;
    CacheProxy.put('Queue', JSON.stringify(queue));
  }

  static sell(coinName: string): void {
    const queue = this.getQueue();
    queue[coinName] = QueueAction.SELL;
    CacheProxy.put('Queue', JSON.stringify(queue));
  }

  static setHold(coinName: string, value: boolean): void {
    const queue = this.getQueue();
    queue[coinName] = value ? QueueAction.HOLD : QueueAction.NOT_HOLD;
    CacheProxy.put('Queue', JSON.stringify(queue));
  }

  static flush(): void {
    const store = DefaultStore;
    const config = store.getConfig();
    const queue = this.getQueue();

    Object.keys(queue).forEach(coinName => {
      try {
        const symbol = new ExchangeSymbol(coinName, config.PriceAsset);
        const action = queue[coinName];
        if (action === QueueAction.BUY) {
          const trade = store.getTrade(symbol) || new TradeMemo(new TradeResult(symbol));
          trade.setState(TradeState.BUY);
          store.setTrade(trade);
        } else if (action === QueueAction.NOT_BUY) {
          const trade = store.getTrade(symbol);
          if (trade) {
            if (trade.tradeResult.quantity) {
              trade.setState(TradeState.BOUGHT);
              store.setTrade(trade);
            } else {
              store.deleteTrade(trade);
            }
          }
        } else if (action === QueueAction.SELL) {
          const trade = store.getTrade(symbol);
          if (trade) {
            trade.setState(TradeState.SELL);
            store.setTrade(trade);
          }
        } else if (action === QueueAction.HOLD || action === QueueAction.NOT_HOLD) {
          const trade = store.getTrade(symbol);
          if (trade) {
            trade.hodl = action === QueueAction.HOLD;
            store.setTrade(trade);
          }
        } else if (action === QueueAction.DROP) {
          const trade = store.getTrade(symbol);
          if (trade) {
            if (trade.stateIs(TradeState.SOLD) || trade.stateIs(TradeState.BUY)) {
              store.deleteTrade(trade);
            } else {
              Log.error(new Error(`Cannot drop ${coinName} as it is not sold`));
            }
          }
        }
        delete queue[coinName];
      } catch (e) {
        Log.error(e)
      }
    });

    CacheProxy.put('Queue', JSON.stringify(queue));
  }

  static dropCoin(coinName: string) {
    const queue = this.getQueue();
    queue[coinName] = QueueAction.DROP;
    CacheProxy.put('Queue', JSON.stringify(queue));
  }

  static cancelBuy(coinName: string) {
    const queue = this.getQueue();
    queue[coinName] = QueueAction.NOT_BUY;
    CacheProxy.put('Queue', JSON.stringify(queue));
  }
}

enum QueueAction {
  BUY = 'BUY',
  NOT_BUY = 'NOT_BUY',
  SELL = 'SELL',
  HOLD = 'HOLD',
  NOT_HOLD = 'NOT_HOLD',
  DROP = 'DROP'
}
