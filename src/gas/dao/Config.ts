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
    const cfg: Config = Object.assign({}, config);
    if (cfg.KEY === MASK || cfg.SECRET === MASK) {
      const curCfg = this.get();
      cfg.KEY = cfg.KEY === MASK ? curCfg.KEY : cfg.KEY;
      cfg.SECRET = cfg.SECRET === MASK ? curCfg.SECRET : cfg.SECRET;
    }
    this.store.set(`Config`, cfg);
  }

  getAPIKeys(): APIKeys {
    const config = this.get();
    return { key: config.KEY, secret: config.SECRET };
  }
}
