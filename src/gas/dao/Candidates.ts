import {
  type CandidateInfo,
  type Coin,
  type CoinName,
  type ICandidatesDao,
  type IStore,
} from "../../lib";

const CandidatesDataKey = `CandidatesV4`;

export class CandidatesDao implements ICandidatesDao {
  private memCache: Record<string, CandidateInfo> = {};

  constructor(private readonly store?: IStore) {}

  getAll(): Record<string, CandidateInfo> {
    return this.store?.get(CandidatesDataKey) || this.memCache;
  }

  get(coin: CoinName): CandidateInfo {
    coin = coin?.toUpperCase();
    return this.getAll()[coin];
  }

  set(coin: Coin, data: CandidateInfo): void {
    const all = this.getAll();
    all[coin.name] = data;
    this.store?.set(CandidatesDataKey, all);
  }

  setAll(data: Record<string, CandidateInfo>): void {
    this.memCache = data;
    this.store?.set(CandidatesDataKey, data);
  }

  delete(coin: Coin): void {
    const all = this.getAll();
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete all[coin.name];
    this.store?.set(CandidatesDataKey, all);
  }
}
