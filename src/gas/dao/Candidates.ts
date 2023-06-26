import {
  type CandidateInfo,
  type CoinName,
  type ICandidatesDao,
  type IStore,
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
