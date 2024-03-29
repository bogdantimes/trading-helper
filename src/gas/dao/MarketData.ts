import {
  calculateBollingerBands,
  f3,
  floor,
  type IMarketDataDao,
  type IStore,
  type MarketData,
} from "../../lib/index";

const key = `MarketData`;

export class MarketDataDao implements IMarketDataDao {
  constructor(
    private readonly store: IStore,
    private readonly historyMin = 10,
    private readonly historyMax = 20,
  ) {}

  getStrength(currentDemand: number): number {
    const { min, max, ready } = this.#getRange();
    return ready ? floor((currentDemand - min) / (max - min), 4) : 0.5;
  }

  updateDemandHistory(
    getDemand: () => { accuracy: number; average: number },
    step: number,
  ): boolean {
    const md = this.get();
    // update once a day
    const oneDayInMs = 24 * 60 * 60 * 1000; // Hours*Minutes*Seconds*Milliseconds
    const lastUpdatedDayAgo = Date.now() - md.lastHistoryUpdate >= oneDayInMs;
    if (step < 0 ? lastUpdatedDayAgo : step % 1440 === 0) {
      const { average, accuracy } = getDemand();
      if (accuracy > 0.5) {
        md.demandHistory.push(f3(average));
        md.demandHistory = md.demandHistory.slice(-this.historyMax);
        md.lastHistoryUpdate = Date.now();
        this.#set(md);
        return true;
      }
    }

    return false;
  }

  get(): MarketData {
    let md = this.store.get<MarketData>(key);

    if (md) {
      let changed = false;
      // If history max was changed to be larger - fill in to match the length
      while (md.demandHistory.length < this.historyMax) {
        md.demandHistory = [0, ...md.demandHistory];
        changed = true;
      }
      if (changed) {
        this.store.update<MarketData>(key, (v) => md!);
      }
    } else {
      // init with a default value
      md = {
        demandHistory: new Array(this.historyMax).fill(0),
        lastHistoryUpdate: 0,
      };
      this.store.update<MarketData>(key, (v) => md!);
    }

    return md;
  }

  #getRange(): { min: number; max: number; ready: boolean } {
    const md = this.get();
    if (md.demandHistory.filter(Boolean).length < this.historyMin) {
      return { min: 0, max: 0, ready: false };
    }
    const bb = calculateBollingerBands(md.demandHistory, this.historyMax, 2);
    return { min: f3(bb.lower), max: f3(bb.upper), ready: true };
  }

  #set(md: MarketData) {
    this.store.update<MarketData>(key, (v) => {
      return md;
    });
  }
}
