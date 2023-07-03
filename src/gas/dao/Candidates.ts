import {
  type CandidateInfo,
  type CoinName,
  type ICandidatesDao,
  type IStore,
  Key,
} from "../../lib";

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

  getAverageImbalance(): number {
    const imbs: number[] = [];
    Object.values(this.getAll()).forEach((c) => {
      const imb = c[Key.IMBALANCE];
      if (imb && imb !== -1) {
        imbs.push(imb);
      }
    });
    return imbs.reduce((sum, imb) => sum + imb, 0) / imbs.length;
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
}
