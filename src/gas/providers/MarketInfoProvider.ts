import {
  type ICandidatesDao,
  type IMarketDataDao,
  StableUSDCoin,
} from "../../lib/Types";
import {
  BullRun,
  calculateBollingerBands,
  floor,
  type MarketInfo,
} from "../../lib/index";
import { type TraderPlugin } from "../traders/plugin/api";

export class MarketInfoProvider {
  constructor(
    private readonly mktDataDao: IMarketDataDao,
    private readonly candidatesDao: ICandidatesDao,
    private readonly plugin: TraderPlugin,
  ) {}

  get(step: number): MarketInfo {
    const imbalance = this.candidatesDao.getAverageImbalance();
    this.mktDataDao.updateDemandHistory(() => imbalance, step);

    const mktPercentile = this.mktDataDao.getStrength(imbalance.average);
    const btcCur = this.plugin.getPrices()[`BTC${StableUSDCoin.USDT}`];
    const btcDaily = this.plugin.getDailyPrices().BTC;

    if (!btcCur || !btcDaily?.prices[0]) {
      return {
        strength: mktPercentile,
        averageDemand: imbalance.average,
        accuracy: imbalance.accuracy,
        bullRun: BullRun.No,
      };
    }

    const { upper, lower } = calculateBollingerBands(
      btcDaily.prices,
      btcDaily.maxCap,
      2,
    );

    const btcPercentile = floor((btcCur - lower) / (upper - lower), 4);
    const strength = floor(mktPercentile + (btcPercentile - 0.5), 4);
    const btcVMktGap = btcPercentile - mktPercentile;
    const bullRun =
      btcVMktGap > 2
        ? BullRun.Yes
        : btcVMktGap < 0.5
        ? BullRun.No
        : BullRun.Unknown;

    return {
      // limit to 0..1
      strength: Math.max(0, Math.min(1, strength)),
      averageDemand: imbalance.average,
      accuracy: imbalance.accuracy,
      bullRun,
    };
  }
}
