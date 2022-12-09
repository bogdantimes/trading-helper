import { Config, IStore, MarketTrend, MASK, StableUSDCoin } from "../../lib";

export const DefaultConfig: () => Config = () => ({
  StableCoin: StableUSDCoin.BUSD,
  StableBalance: -1, // -1 Auto detect
  FeesBudget: -1, // -1 Auto detect
  SellAtStopLimit: true,
  MarketTrend: -1, // -1 Auto detect
  AutoMarketTrend: MarketTrend.SIDEWAYS,
  AdvancedAccess: false,
  ViewOnly: false,
  HideBalances: false,
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
    if (config.KEY === MASK || config.SECRET === MASK) {
      const curCfg = this.get();
      config.KEY = config.KEY === MASK ? curCfg.KEY : config.KEY;
      config.SECRET = config.SECRET === MASK ? curCfg.SECRET : config.SECRET;
    }
    this.store.set(`Config`, config);
  }
}
