import {
  AUTO_DETECT,
  type Config,
  type IStore,
  MASK,
  StableUSDCoin,
  StoreNoOp,
} from "../../lib";

export interface APIConfigProvider {
  getAPIKeys: () => APIKeys;
  isDryRun: () => boolean;
}

export interface APIKeys {
  key?: string;
  secret?: string;
}

export const DefaultConfig: () => Config = () => ({
  StableCoin: StableUSDCoin.USDT,
  StableBalance: AUTO_DETECT,
  FeesBudget: AUTO_DETECT,
  AutoReplenishFees: true,
  AdvancedAccess: false,
  ViewOnly: false,
  HideBalances: false,
  SmartExit: true,
  BudgetSplitMin: 1,
});

export class ConfigDao implements APIConfigProvider {
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
    delete config.SellAtStopLimit;

    // apply existing config on top of default one
    config = Object.assign(defaultConfig, config);
    return config;
  }

  update(mutateFn: (curCfg: Config) => Config | undefined): Config {
    let cfg: Config;
    this.store.update<Config>(`Config`, (curCfg) => {
      // return cfg with default values assigned
      cfg = this.#mergeDefault(curCfg);
      const mutCfg = mutateFn(cfg);
      if (mutCfg) {
        cfg = Object.assign({}, mutCfg);
        if (cfg.KEY === MASK || cfg.SECRET === MASK) {
          cfg.KEY = cfg.KEY === MASK ? curCfg.KEY : cfg.KEY;
          cfg.SECRET = cfg.SECRET === MASK ? curCfg.SECRET : cfg.SECRET;
        }
        return cfg;
      } else if (curCfg) {
        return StoreNoOp;
      } else {
        return cfg;
      }
    });
    return cfg!;
  }

  updateWithRetry(
    mutateFn: (curCfg: Config) => Config | undefined,
    maxRetries: number,
    retryIntervalMs: number,
  ): Config {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        return this.update(mutateFn);
      } catch (error) {
        retries++;
        if (retries === maxRetries) {
          throw error; // Max retries reached, re-throw the error
        } else {
          Utilities.sleep(retryIntervalMs);
        }
      }
    }
    throw new Error(`Failed to update config after ${maxRetries}`);
  }

  getAPIKeys(): APIKeys {
    const config = this.get();
    return { key: config.KEY, secret: config.SECRET };
  }

  isDryRun(): boolean {
    return !!this.get().DryRun;
  }
}
