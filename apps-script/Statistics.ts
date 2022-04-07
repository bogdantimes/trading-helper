import {IStore} from "./Store";

export class Statistics {
  private readonly store: IStore

  constructor(store: IStore) {
    this.store = store;
  }

  getTotalProfit(): number {
    return +this.store.getOrSet("totalProfit", "0")
  }

  addProfit(profit: number): number {
    const totalProfit = this.getTotalProfit();

    const date = new Date().toDateString();
    const statistics = this.store.get("Statistics") || {};

    statistics.DailyProfit = statistics.DailyProfit || {};
    statistics.DailyProfit[date] = +(statistics.DailyProfit[date] || 0) + profit;
    statistics.TotalProfit = totalProfit + profit;
    this.store.set("Statistics", statistics);
    return statistics.TotalProfit
  }
}
