class Statistics {
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

  bumpLossProfitMeter(symbol: ExchangeSymbol): number {
    const val = +this.store.getOrSet(`lpMeter/${symbol}`, "3");
    return +this.store.set(`lpMeter/${symbol}`, String(Math.max(val + 1, 3)))
  }

  dumpLossProfitMeter(symbol: ExchangeSymbol): number {
    const val = +this.store.getOrSet(`lpMeter/${symbol}`, "3");
    return +this.store.set(`lpMeter/${symbol}`, String(Math.min(val - 1, 0)))
  }
}
