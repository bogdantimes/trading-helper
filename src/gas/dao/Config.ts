import { Config, MarketCycle, IStore, StableUSDCoin } from "../../lib";

export const DefaultConfig: () => Config = () => ({
  StableCoin: StableUSDCoin.BUSD,
  StableBalance: -1, // -1 is to initiate using all available balance.
  SellAtStopLimit: true,
  MarketCycle: -1, // -1 Auto detect
  AutoMarketCycle: MarketCycle.SIDEWAYS,
});

export class ConfigDao {
  private readonly store: IStore;

  constructor(store: IStore) {
    this.store = store;
  }

  isInitialized(): boolean {
    return !!this.store.get(`Config`);
  }

  get(): Config {
    const defaultConfig = DefaultConfig();
    let config: Config = this.store.getOrSet(`Config`, defaultConfig);
    // apply existing config on top of default one
    config = Object.assign(defaultConfig, config);
    return config;
  }

  set(config: Config): void {
    this.store.set(`Config`, config);
  }
}
