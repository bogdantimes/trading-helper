import {
  AUTO_DETECT,
  type Config,
  type IStore,
  MarketTrend,
  MASK,
  StableUSDCoin,
} from "../../lib";

export interface APIKeysProvider {
  getAPIKeys: () => APIKeys;
}

export interface APIKeys {
  key?: string;
  secret?: string;
}

export const DefaultConfig: () => Config = () => ({
  StableCoin: StableUSDCoin.BUSD,
  StableBalance: AUTO_DETECT,
  FeesBudget: AUTO_DETECT,
  SellAtStopLimit: true,
  MarketTrend: AUTO_DETECT,
  AutoMarketTrend: MarketTrend.SIDEWAYS,
  AdvancedAccess: false,
  ViewOnly: false,
  HideBalances: false,
  EntryImbalanceCheck: true,
});

export class ConfigDao implements APIKeysProvider {
  private readonly store: IStore;

  constructor(store: IStore) {
    this.store = store;
  }

  get(): Config {
    const defaultConfig = DefaultConfig();
    let config: Config = this.store.get(`Config`) || defaultConfig;
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

  getAPIKeys(): APIKeys {
    const config = this.get();
    return { key: config.KEY, secret: config.SECRET };
  }
}
