import {
  AUTO_DETECT,
  type Config,
  type IStore,
  MASK,
  StableUSDCoin,
  StoreNoOp,
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
    return this.#mergeDefault(this.store.get(`Config`));
  }

  #mergeDefault(cfg?: Config): Config {
    const defaultConfig = DefaultConfig();
    let config: Config = cfg || defaultConfig;

    // Back-ward compatibility with v3
    config.SmartExit = config.SellAtStopLimit ?? config.SmartExit;
    config.SellAtStopLimit = undefined;

    // apply existing config on top of default one
    config = Object.assign(defaultConfig, config);
    return config;
  }

  update(mutateFn: (curCfg: Config) => Config | undefined): Config {
    return this.store.update<Config>(`Config`, (curCfg) => {
      curCfg = this.#mergeDefault(curCfg);
      const mutCfg = mutateFn(curCfg);
      if (mutCfg) {
        const cfg = Object.assign({}, mutCfg);
        if (cfg.KEY === MASK || cfg.SECRET === MASK) {
          cfg.KEY = cfg.KEY === MASK ? curCfg.KEY : cfg.KEY;
          cfg.SECRET = cfg.SECRET === MASK ? curCfg.SECRET : cfg.SECRET;
        }
        return cfg;
      } else if (curCfg) {
        return StoreNoOp;
      } else {
        return curCfg;
      }
    })!;
  }

  getAPIKeys(): APIKeys {
    const config = this.get();
    return { key: config.KEY, secret: config.SECRET };
  }
}
