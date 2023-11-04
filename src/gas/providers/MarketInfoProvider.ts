import {
  type ICandidatesDao,
  type IMarketDataDao,
  StableUSDCoin,
} from "../../lib/Types";
import {
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

  get(): MarketInfo {
    const imbalance = this.candidatesDao.getAverageImbalance();
    const mktPercentile = this.mktDataDao.getStrength(imbalance.average);
    const btcCur = this.plugin.getPrices()[`BTC${StableUSDCoin.USDT}`];
    const btcDaily = this.plugin.getDailyPrices().BTC;

    if (!btcCur || !btcDaily) {
      return {
        strength: mktPercentile,
        averageDemand: imbalance.average,
        accuracy: imbalance.accuracy,
      };
    }

    const { upper, lower } = calculateBollingerBands(
      btcDaily.prices,
      btcDaily.maxCap,
      2,
    );

    const btcPercentile = floor((btcCur - lower) / (upper - lower), 4);
    const strength = floor(mktPercentile + (btcPercentile - 0.5), 4);

    return {
      // limit to 0..1
      strength: Math.max(0, Math.min(1, strength)),
      averageDemand: imbalance.average,
      accuracy: imbalance.accuracy,
    };
  }

  update(step: number) {
    this.mktDataDao.updateDemandHistory(
      () => this.candidatesDao.getAverageImbalance(),
      step,
    );
  }
}
