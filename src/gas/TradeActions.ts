import { DefaultStore } from "./Store";
import { TradesDao } from "./dao/Trades";

/**
 * @deprecated
 */
export class TradeActions {
  static default(): TradeActions {
    const tradesDao = new TradesDao(DefaultStore);
    return new TradeActions(tradesDao);
  }

  constructor(readonly tradesDao: TradesDao) {}

  drop(coinName: string): void {
    this.tradesDao.update(coinName, (trade) => {
      trade.deleted = true;
      return trade;
    });
  }
}
