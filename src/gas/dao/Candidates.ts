import {
  Bit,
  type CandidateInfo,
  type CoinName,
  f2,
  type ICandidatesDao,
  type IStore,
  Key,
} from "../../lib";
import { Log } from "../Common";

const CandidatesDataKey = `CandidatesV4`;

export class CandidatesDao implements ICandidatesDao {
  constructor(private readonly store: IStore) {}

  getAll(): Record<string, CandidateInfo> {
    return this.store.get(CandidatesDataKey) || {};
  }

  get(coin: CoinName): CandidateInfo {
    coin = coin?.toUpperCase();
    return this.getAll()[coin];
  }

  getAverageImbalance(): { average: number; accuracy: number } {
    const imbs: number[] = [];
    const all = Object.values(this.getAll());
    all.forEach((c) => {
      const imb = c[Key.IMBALANCE];
      if (imb && imb !== -1) {
        imbs.push(imb);
      }
    });
    const accuracy = f2(imbs.length / all.length);
    const average = imbs.reduce((sum, imb) => sum + imb, 0) / imbs.length;
    return { average, accuracy };
  }

  update(
    mutateFn: (
      data: Record<string, CandidateInfo>
    ) => Record<string, CandidateInfo>
  ): void {
    this.store.update<Record<string, CandidateInfo>>(CandidatesDataKey, (v) =>
      mutateFn(v || {})
    );
  }

  pin(coin: CoinName, value = true): void {
    const ci = this.get(coin);
    if (!ci) {
      Log.info(`${coin}: no such Candidate.`);
      return;
    }
    if (!!ci?.[Key.PINNED] === value) {
      Log.info(`${coin} already ${value ? `` : `un`}pinned`);
      return;
    }

    this.update((all) => {
      if (all[coin]) {
        all[coin][Key.PINNED] = value ? Bit.TRUE : Bit.FALSE;
      }
      return all;
    });

    Log.info(`${coin} ${value ? `` : `un`}pinned`);
  }
}
