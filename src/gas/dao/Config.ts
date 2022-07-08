import { Config, IStore, PriceProvider, StableUSDCoin } from "../../lib"

export const DefaultConfig: () => Config = () => ({
  InvestRatio: 1,
  BuyQuantity: 15,
  StableCoin: StableUSDCoin.USDT,
  StopLimit: 0.05,
  ProfitLimit: 0.1,
  SellAtStopLimit: true,
  SellAtProfitLimit: false,
  SwingTradeEnabled: false,
  PriceProvider: PriceProvider.Binance,
  AveragingDown: false,
  ProfitBasedStopLimit: false,
  PriceAnomalyAlert: 5,
  ChannelSize: 0,
  ChannelWindowMins: 0,
})

export class ConfigDao {
  private readonly store: IStore

  constructor(store: IStore) {
    this.store = store
  }

  isInitialized(): boolean {
    return !!this.store.get(`Config`)
  }

  get(): Config {
    const defaultConfig = DefaultConfig()
    let config: Config = this.store.getOrSet(`Config`, defaultConfig)
    // apply existing config on top of default one
    config = Object.assign(defaultConfig, config)

    if (config.TakeProfit) {
      config.ProfitLimit = config.TakeProfit
      delete config.TakeProfit
    }

    if (config.SellAtTakeProfit) {
      config.SellAtProfitLimit = config.SellAtTakeProfit
      delete config.SellAtTakeProfit
    }

    if (config.LossLimit) {
      config.StopLimit = config.LossLimit
      delete config.LossLimit
    }

    if (config.PriceAsset) {
      config.StableCoin = <StableUSDCoin>config.PriceAsset
      delete config.PriceAsset
    }

    return config
  }

  set(config: Config): void {
    this.store.set(`Config`, config)
  }
}
