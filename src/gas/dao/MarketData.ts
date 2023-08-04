import {
  calculateBollingerBands,
  f0,
  f2,
  type IStore,
  StoreNoOp,
} from "../../lib/index";

export interface MarketData {
  demandHistory: number[];
  lastHistoryUpdate: number;
}

const key = `MarketData`;

export class MarketDataDao {
  constructor(
    private readonly store: IStore,
    private readonly historyMin = 5,
    private readonly historyMax = 20
  ) {}

  get(): MarketData {
    return this.store.update<MarketData>(key, (v) => {
      const defaultValue = {
        demandHistory: [],
        lastHistoryUpdate: 0,
      };
      if (v && !v.demandHistory.length) {
        v.lastHistoryUpdate = 0;
      }
      return v ? StoreNoOp : defaultValue;
    })!;
  }

  getRange(): { min: number; max: number; ready: boolean } {
    const md = this.get();
    if (md.demandHistory.length < this.historyMin) {
      return { min: 0, max: 0, ready: false };
    }
    const bb = calculateBollingerBands(md.demandHistory, this.historyMin, 2);
    return { min: f2(bb.lower), max: f2(bb.upper), ready: true };
  }

  getPercentile(currentDemand: number): number {
    const { min, max, ready } = this.getRange();
    return ready ? f0(((currentDemand - min) / (max - min)) * 100) : -1;
  }

  set(md: MarketData) {
    this.store.update<MarketData>(key, (v) => {
      return md;
    });
  }

  updateDemandHistory(
    getDemand: () => { accuracy: number; average: number }
  ): boolean {
    const md = this.get();

    // update once a day
    const oneDayInMilliseconds = 24 * 60 * 60 * 1000; // Hours*Minutes*Seconds*Milliseconds
    if (Date.now() - md.lastHistoryUpdate >= oneDayInMilliseconds) {
      const { accuracy, average } = getDemand();
      if (accuracy > 0.8) {
        md.demandHistory.push(f2(average));
        md.demandHistory = md.demandHistory.slice(-this.historyMax);
        md.lastHistoryUpdate = Date.now();
        this.set(md);
        return true;
      }
    }

    return false;
  }
}
