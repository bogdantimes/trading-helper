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
    return +this.store.set("totalProfit", String(this.getTotalProfit() + profit))
  }

  getTotalCommission(): number {
    return +this.store.getOrSet("totalCommission", "0")
  }

  addCommission(commission: number): number {
    return +this.store.set("totalCommission", String(this.getTotalCommission() + commission))
  }
}
