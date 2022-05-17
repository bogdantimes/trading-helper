import {DefaultStore} from "./Store";
import {TradeMemo, TradeState} from "./TradeMemo";
import {ExchangeSymbol, TradeResult} from "./TradeResult";
import {CacheProxy} from "./CacheProxy";

export class TradesQueue {

  static getQueue(): { [key: string]: QueueAction } {
    const queueJson = CacheProxy.get('Queue');
    return queueJson ? JSON.parse(queueJson) : {};
  }

  static buy(coinName: string): void {
    const queue = this.getQueue();
    queue[coinName.toUpperCase()] = {type: QueueActionType.BUY};
    CacheProxy.put('Queue', JSON.stringify(queue));
  }

  static sell(coinName: string): void {
    const queue = this.getQueue();
    queue[coinName.toUpperCase()] = {type: QueueActionType.SELL};
    CacheProxy.put('Queue', JSON.stringify(queue));
  }

  static setHold(coinName: string, value: boolean): void {
    const queue = this.getQueue();
    queue[coinName.toUpperCase()] = {type: QueueActionType.HOLD, value};
    CacheProxy.put('Queue', JSON.stringify(queue));
  }

  static flush(): void {
    const store = DefaultStore;
    const config = store.getConfig();
    const queue = this.getQueue();

    Object.keys(queue).forEach(coinName => {
      try {
        const symbol = new ExchangeSymbol(coinName, config.StableCoin);
        const action = queue[coinName];
        if (action.type === QueueActionType.BUY) {
          const trade = store.getTrade(symbol) || new TradeMemo(new TradeResult(symbol));
          trade.setState(TradeState.BUY);
          trade.tradeResult.symbol = symbol;
          store.setTrade(trade);
        } else if (action.type === QueueActionType.CANCEL) {
          const trade = store.getTrade(symbol);
          if (trade) {
            if (trade.tradeResult.quantity) {
              trade.setState(TradeState.BOUGHT);
              store.setTrade(trade);
            } else if (trade.tradeResult.price) {
              trade.setState(TradeState.SOLD);
              store.setTrade(trade);
            } else {
              store.deleteTrade(trade);
            }
          }
        } else if (action.type === QueueActionType.SELL) {
          const trade = store.getTrade(symbol);
          if (trade) {
            trade.setState(TradeState.SELL);
            store.setTrade(trade);
          }
        } else if (action.type === QueueActionType.HOLD) {
          const trade = store.getTrade(symbol);
          if (trade) {
            trade.hodl = action.value;
            store.setTrade(trade);
          }
        } else if (action.type === QueueActionType.DROP) {
          const trade = store.getTrade(symbol);
          if (trade) {
            if (trade.stateIs(TradeState.SOLD) || trade.stateIs(TradeState.BUY)) {
              store.deleteTrade(trade);
            } else {
              Log.error(new Error(`Cannot drop ${coinName} as it is not sold`));
            }
          }
        } else if (action.type === QueueActionType.REPLACE) {
          const trade = store.getTrade(symbol);
          if (trade) {
            const updatedTrade = TradeMemo.copy(action.value);
            if (trade.getCoinName() != updatedTrade.getCoinName()) {
              // if symbol changed, delete the old one
              // and reset prices in the new one
              updatedTrade.prices = [0, 0, 0];
              store.deleteTrade(trade);
            }
            store.setTrade(updatedTrade);
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
    queue[coinName.toUpperCase()] = {type: QueueActionType.DROP};
    CacheProxy.put('Queue', JSON.stringify(queue));
  }

  static cancelAction(coinName: string) {
    const queue = this.getQueue();
    queue[coinName.toUpperCase()] = {type: QueueActionType.CANCEL};
    CacheProxy.put('Queue', JSON.stringify(queue));
  }

  static replace(coinName: string, value: TradeMemo) {
    const queue = this.getQueue();
    queue[coinName.toUpperCase()] = {type: QueueActionType.REPLACE, value};
    CacheProxy.put('Queue', JSON.stringify(queue));
  }
}

enum QueueActionType {
  BUY = 'BUY',
  CANCEL = 'CANCEL',
  SELL = 'SELL',
  HOLD = 'HOLD',
  DROP = 'DROP',
  REPLACE = 'REPLACE'
}

type QueueAction = {
  type: QueueActionType
  value?: any
}
