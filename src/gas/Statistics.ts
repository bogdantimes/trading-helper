import { f2, Stats } from "trading-helper-lib"
import { IStore } from "./Store"

export class Statistics {
  private readonly store: IStore

  constructor(store: IStore) {
    this.store = store
  }

  addProfit(profit: number): number {
    const stats = this.getAll()
    const date = new Date().toDateString()
    const dailyProfit = (stats.DailyProfit[date] || 0) + profit
    stats.DailyProfit[date] = f2(dailyProfit)
    stats.TotalProfit = f2(stats.TotalProfit + profit)

    this.store.set(`Statistics`, stats)
    return stats.TotalProfit
  }

  getAll(): Stats {
    const statistics = this.store.get(`Statistics`) || {}
    statistics.DailyProfit = statistics.DailyProfit || {}
    statistics.TotalProfit = statistics.TotalProfit || 0
    return statistics
  }

  get totalProfit(): number {
    return this.getAll().TotalProfit
  }
}
