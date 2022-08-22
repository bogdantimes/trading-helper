import { DefaultStore } from "./Store";
import { TradeMemo } from "../lib";
import { TradesDao } from "./dao/Trades";
import { ConfigDao } from "./dao/Config";

/**
 * @deprecated
 */
export class TradeActions {
  static default(): TradeActions {
    const configDao = new ConfigDao(DefaultStore);
    const tradesDao = new TradesDao(DefaultStore);
    return new TradeActions(tradesDao, configDao);
  }

  constructor(readonly tradesDao: TradesDao, readonly configDao: ConfigDao) {}

  setHold(coinName: string, value: boolean): void {
    const config = this.configDao.get();
    if (value) {
      config.HODL.push(coinName);
    } else {
      config.HODL = config.HODL.filter((c) => c !== coinName);
    }
    this.configDao.set(config);
  }

  drop(coinName: string): void {
    this.tradesDao.update(coinName, (trade) => {
      trade.deleted = true;
      return trade;
    });
  }

  replace(coinName: string, newTrade: TradeMemo): void {
    this.tradesDao.update(
      coinName,
      (trade) => {
        if (trade.getCoinName() !== newTrade.getCoinName()) {
          // if coin name changed reset prices
          newTrade.prices = [];
          newTrade.stopLimitPrice = 0;
        }
        return newTrade;
      },
      () => newTrade
    );
    if (coinName !== newTrade.getCoinName()) {
      // if coin name changed delete old one
      this.drop(coinName);
    }
  }
}
