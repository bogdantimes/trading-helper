import { f2, formatUSDCurrency, type IStore, type Stats } from "../lib";
import { Log } from "./Common";

export class Statistics {
  private readonly store: IStore;

  constructor(store: IStore) {
    this.store = store;
  }

  addProfit(profit: number): number {
    const stats = this.getAll();
    // DailyProfit day format is "Mon Jan 01 2021" (or "Jan 2021" for compressed data)
    const date = new Date().toDateString();
    const dailyProfit = (stats.DailyProfit[date] || 0) + profit;
    stats.DailyProfit[date] = f2(dailyProfit);
    stats.TotalProfit = stats.TotalProfit + profit;

    Log.info(
      `${formatUSDCurrency(
        profit,
      )} added to statistics. Today: ${formatUSDCurrency(
        stats.DailyProfit[date],
      )}. Total: ${formatUSDCurrency(stats.TotalProfit)}.`,
    );

    this.saveAll(stats);
    return stats.TotalProfit;
  }

  addWithdrawal(amount: number): void {
    if (amount <= 0) {
      throw Error(`Invalid amount: ${amount}`);
    }
    const stats = this.getAll();
    stats.TotalWithdrawals = stats.TotalWithdrawals + amount;
    stats.TotalProfit = stats.TotalProfit - amount;
    this.saveAll(stats);
  }

  getAll(): Stats {
    const statistics =
      this.store.get<Stats>(`Statistics`) ?? ({} as any as Stats);
    statistics.DailyProfit = statistics.DailyProfit || {};
    statistics.TotalProfit = statistics.TotalProfit || 0;
    statistics.TotalWithdrawals = statistics.TotalWithdrawals || 0;
    return statistics;
  }

  saveAll(stats: Stats): void {
    try {
      this.store.update(`Statistics`, () => stats);
    } catch (e) {
      Log.error(e);
      // Free up some space and try again
      this.store.update(`Statistics`, () => {
        this.#compressOldestMonth(stats);
        return stats;
      });
    }
  }

  get totalProfit(): number {
    return this.getAll().TotalProfit;
  }

  /**
   * Compresses DailyProfit of the oldest month into a single record
   * @param stats
   * @private
   */
  #compressOldestMonth(stats: Stats): void {
    const allRecs = Object.keys(stats.DailyProfit);

    const oldestRec: Date = allRecs
      .map((d) => new Date(d))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    const recsToZip = allRecs.filter(
      (d) =>
        new Date(d).getMonth() === oldestRec?.getMonth() &&
        new Date(d).getFullYear() === oldestRec?.getFullYear(),
    );

    // Calculate the total profit for these records
    const r = recsToZip.reduce((s, d) => s + stats.DailyProfit[d], 0);

    // Delete them from the stats
    recsToZip.forEach((d) => delete stats.DailyProfit[d]);

    if (r) {
      // Put as "Jan 2021" format record
      const monthShort = oldestRec.toDateString().split(` `)[1];
      const date = `${monthShort} ${oldestRec.getFullYear()}`;
      stats.DailyProfit[date] = f2(r);
      Log.alert(
        `Oldest month records (${date}) were compressed into a single record to free up space.`,
      );
    }
  }
}
