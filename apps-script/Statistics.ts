import {IStore} from "./Store";
import {PriceMap} from "./shared-lib/types";

export type Stats = {
  TotalProfit: number;
  DailyProfit: PriceMap;
}

export class Statistics {
  private readonly store: IStore

  constructor(store: IStore) {
    this.store = store;
  }

  addProfit(profit: number): number {
    const stats = this.getAll();
    const date = new Date().toDateString();
    const dailyProfit = (stats.DailyProfit[date] || 0) + profit;
    stats.DailyProfit[date] = +dailyProfit.toFixed(2);
    stats.TotalProfit = +(stats.TotalProfit + profit).toFixed(2);

    this.store.set("Statistics", stats);
    return stats.TotalProfit
  }

  getAll(): Stats {
    const statistics = this.store.get("Statistics") || {};
    statistics.DailyProfit = statistics.DailyProfit || {};
    statistics.TotalProfit = statistics.TotalProfit || 0;
    return statistics;
  }
}
