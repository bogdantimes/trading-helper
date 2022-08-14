import { Config, IStore, StableUSDCoin } from "../../lib";

export const DefaultConfig: () => Config = () => ({
  InvestRatio: 1,
  BuyQuantity: 15,
  StableCoin: StableUSDCoin.USDT,
  ProfitLimit: 0.1,
  SellAtStopLimit: true,
  ProfitBasedStopLimit: false,
  ChannelSize: 0,
  ChannelWindowMins: 0,
  TTL: 60 * 24 * 3, // 3 days
  HODL: [],
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
