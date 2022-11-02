import {
  ChannelState,
  Coin,
  CoinName,
  IStore,
  Key,
  PriceChannelData,
} from "../../lib";
import { isNode } from "browser-or-node";

const PriceChannelDataKey = `ChannelData`;

export class ChannelsDao {
  static isCandidate(ch: PriceChannelData, percentile: number): boolean {
    const { TOP, MIDDLE } = ChannelState;
    const { [Key.S0]: s0, [Key.S1]: s1, [Key.S2]: s2 } = ch;
    const isCandidate = s0 === MIDDLE && s1 === TOP;
    const isReady = s0 === TOP && s1 === MIDDLE && s2 === s0;
    return (
      ch[Key.DURATION_MET] &&
      ch[Key.MIN_PERCENTILE] >= percentile &&
      (isCandidate || isReady)
    );
  }

  private memCache: { [p: string]: PriceChannelData };

  constructor(private readonly store: IStore) {}

  getAll(): { [p: string]: PriceChannelData } {
    if (isNode && this.memCache) {
      // performance optimization for back-testing
      return this.memCache;
    }
    const data = this.store.getOrSet(PriceChannelDataKey, {});
    this.memCache = data;
    return data;
  }

  get(coin: CoinName): PriceChannelData {
    return this.getAll()[coin];
  }

  set(coin: Coin, data: PriceChannelData): void {
    const all = this.getAll();
    all[coin.name] = data;
    this.store.set(PriceChannelDataKey, all);
  }

  setAll(data: { [p: string]: PriceChannelData }): void {
    this.memCache = data;
    this.store.set(PriceChannelDataKey, data);
  }

  delete(coin: Coin): void {
    const all = this.getAll();
    delete all[coin.name];
    this.store.set(PriceChannelDataKey, all);
  }

  /** GetCandidates returns a list of coins that are candidates for trading. It is considered as
   * a candidate if:
   * it was within the channel for the required duration
   * it's price is in the top percentile of the channel
   * it's current state is ChannelMid, and it's previous state is ChannelTop
   **/
  getCandidates(percentile: number): { [p: string]: PriceChannelData } {
    const all = this.getAll();
    const candidates: { [p: string]: PriceChannelData } = {};
    Object.keys(all).forEach((key) => {
      const ch = all[key];
      if (ChannelsDao.isCandidate(ch, percentile)) {
        candidates[key] = ch;
      }
    });
    return candidates;
  }
}
