import {IStore} from "./Store";

export class Statistics {
  private readonly store: IStore

  constructor(store: IStore) {
    this.store = store;
  }

  addProfit(profit: number): number {
    const date = new Date().toDateString();
    const statistics = this.store.get("Statistics") || {};

    statistics.DailyProfit = statistics.DailyProfit || {};
    statistics.DailyProfit[date] = +(statistics.DailyProfit[date] || 0) + profit;
    statistics.TotalProfit = (statistics.TotalProfit || 0) + profit;

    this.store.set("Statistics", statistics);
    return statistics.TotalProfit
  }
}
