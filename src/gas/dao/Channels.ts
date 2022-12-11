import { Coin, CoinName, IStore, PriceChannelData } from "../../lib";
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
    const data = this.store.get(PriceChannelDataKey) || {};
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
}
