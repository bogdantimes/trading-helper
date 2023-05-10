import {
  AUTO_DETECT,
  type Config,
  type IStore,
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
  StableCoin: StableUSDCoin.USDT,
  StableBalance: AUTO_DETECT,
  FeesBudget: AUTO_DETECT,
  AutoReplenishFees: false,
  AdvancedAccess: false,
  ViewOnly: false,
  HideBalances: false,
  SmartExit: true,
  BudgetSplitMin: 1,
});

export class ConfigDao implements APIKeysProvider {
  private readonly store: IStore;

  constructor(store: IStore) {
    this.store = store;
  }

  get(): Config {
    const defaultConfig = DefaultConfig();
    let config: Config = this.store.get(`Config`) || defaultConfig;

    // Back-ward compatibility with v3
    config.SmartExit = config.SellAtStopLimit ?? config.SmartExit;
    config.SellAtStopLimit = undefined;

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
