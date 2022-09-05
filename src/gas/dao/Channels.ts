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
   * it was within the channel for the specified duration
   * it's price is in the top 15% of the channel
   * it's current state is ChannelMid, and it's previous state is ChannelTop
   **/
  getCandidates(duration: number): { [p: string]: PriceChannelData } {
    const all = this.getAll();
    const candidates: { [p: string]: PriceChannelData } = {};
    Object.keys(all).forEach((key) => {
      const ch = all[key];
      if (
        ch[Key.DURATION] > duration &&
        ch[Key.PERCENTILE] >= 0.8 &&
        ch[Key.S0] === ChannelState.MIDDLE &&
        ch[Key.S1] === ChannelState.TOP
      ) {
        candidates[key] = ch;
      }
    });
    return candidates;
  }
}
