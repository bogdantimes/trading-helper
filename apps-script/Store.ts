import {TradeMemo, TradeState} from "./TradeMemo";
import {ExchangeSymbol, PriceProvider, TradeResult} from "./TradeResult";
import {CacheProxy} from "./CacheProxy";
import {StableUSDCoin} from "./shared-lib/types";

export interface IStore {
  get(key: String): any

  set(key: String, value: any): any

  getConfig(): Config

  setConfig(config: Config): void

  getOrSet(key: String, value: any): any

  delete(key: String)

  getTrades(): { [key: string]: TradeMemo }

  getTradesList(state?: TradeState): TradeMemo[]

  getTrade(symbol: ExchangeSymbol): TradeMemo

  changeTrade(coinName: string, mutateFn: (tm: TradeMemo) => TradeMemo): void

  dumpChanges(): void

  isConnected(): boolean
}

export class FirebaseStore implements IStore {
  private readonly dbURLKey = "dbURL";
  private source: object

  constructor() {
    const url = PropertiesService.getScriptProperties().getProperty(this.dbURLKey)
    if (url) {
      // @ts-ignore
      this.source = FirebaseApp.getDatabaseByUrl(url, ScriptApp.getOAuthToken());
    } else {
      Log.info("Firebase URL key 'dbURL' is not set.")
    }
  }


  connect(dbURL: string) {
    // @ts-ignore
    this.source = FirebaseApp.getDatabaseByUrl(dbURL, ScriptApp.getOAuthToken());
    PropertiesService.getScriptProperties().setProperty(this.dbURLKey, dbURL);
  }

  isConnected(): boolean {
    return !!this.source
  }

  getConfig(): Config {
    const defaultConfig: Config = {
      BuyQuantity: 10,
      StableCoin: StableUSDCoin.USDT,
      StopLimit: 0.05,
      ProfitLimit: 0.1,
      SellAtStopLimit: false,
      SellAtProfitLimit: true,
      SwingTradeEnabled: false,
      PriceProvider: PriceProvider.Binance,
      AveragingDown: false,
      ProfitBasedStopLimit: false,
      DumpAlertPercentage: 5
    }
    const configCacheJson = CacheProxy.get("Config");
    let configCache: Config = configCacheJson ? JSON.parse(configCacheJson) : null;
    if (!configCache) {
      configCache = this.getOrSet("Config", defaultConfig)
    }
    // apply existing config on top of default one
    configCache = Object.assign(defaultConfig, configCache)

    if (configCache.TakeProfit) {
      configCache.ProfitLimit = configCache.TakeProfit
      delete configCache.TakeProfit
    }

    if (configCache.SellAtTakeProfit) {
      configCache.SellAtProfitLimit = configCache.SellAtTakeProfit
      delete configCache.SellAtTakeProfit
    }

    if (configCache.LossLimit) {
      configCache.StopLimit = configCache.LossLimit
      delete configCache.LossLimit
    }

    if (configCache.PriceAsset) {
      configCache.StableCoin = <StableUSDCoin>configCache.PriceAsset
      delete configCache.PriceAsset
    }

    CacheProxy.put("Config", JSON.stringify(configCache))

    return configCache;
  }

  setConfig(config: Config): void {
    this.set("Config", config)
    CacheProxy.put("Config", JSON.stringify(config))
  }

  delete(key: String) {
    if (!this.isConnected()) {
      throw new Error("Firebase is not connected.")
    }
    // @ts-ignore
    this.source.removeData(key)
  }

  get(key: String): any {
    if (!this.isConnected()) {
      throw new Error("Firebase is not connected.")
    }
    // @ts-ignore
    return this.source.getData(key);
  }

  getOrSet(key: String, value: any): any {
    const val = this.get(key) || value;
    // @ts-ignore
    this.source.setData(key, val)
    return val
  }

  set(key: String, value: any): any {
    if (!this.isConnected()) {
      throw new Error("Firebase is not connected.")
    }
    // @ts-ignore
    this.source.setData(key, value)
    return value
  }

  getTrades(): { [p: string]: TradeMemo } {
    const tradesCacheJson = CacheProxy.get("Trades");
    let tradesCache = tradesCacheJson ? JSON.parse(tradesCacheJson) : null;
    if (!tradesCache) {
      tradesCache = this.getOrSet("trade", {});
      CacheProxy.put("Trades", JSON.stringify(tradesCache))
    }
    // Convert raw trades to TradeMemo objects
    return Object.keys(tradesCache).reduce((acc, key) => {
      acc[key] = TradeMemo.fromObject(tradesCache[key])
      return acc
    }, {});
  }

  getTradesList(state?: TradeState): TradeMemo[] {
    const values = Object.values(this.getTrades());
    return state ? values.filter(trade => trade.stateIs(state)) : values;
  }

  getTrade(symbol: ExchangeSymbol): TradeMemo {
    return this.getTrades()[symbol.quantityAsset]
  }

  /**
   * changeTrade function provides a way to update the trade memo object.
   *
   * It locks the trade memo object for the duration of the mutation function but no more than 30 seconds.
   *
   * It expects a coinName and a mutate function. The mutate function receives either an existing trade memo object
   * from a store or a new empty trade memo.
   *
   * Mutation function can return an updated trade memo object or undefined/null value.
   * If returned trade memo object has deleted flag set to true, this trade memo will be deleted.
   * If undefined/null value is returned, the trade memo will not be updated.
   *
   * @param coinName
   * @param mutateFn
   */
  changeTrade(coinName: string, mutateFn: (tm: TradeMemo) => TradeMemo | undefined | null): void {
    coinName = coinName.toUpperCase();
    const key = `TradeLocker_${coinName}`;
    try {
      while (CacheProxy.get(key)) Utilities.sleep(200);
      CacheProxy.put(key, "true", 30); // Lock for 30 seconds

      const symbol = new ExchangeSymbol(coinName, this.getConfig().StableCoin);
      const existingOrNewTrade = this.getTrades()[coinName] || new TradeMemo(new TradeResult(symbol));
      const changedTrade = mutateFn(existingOrNewTrade);

      if (changedTrade) {
        changedTrade.deleted ?
          this.deleteTrade(changedTrade) :
          this.setTrade(changedTrade);
      }

    } finally {
      CacheProxy.remove(key)
    }
  }

  private setTrade(tradeMemo: TradeMemo) {
    const trades = this.getTrades();
    trades[tradeMemo.tradeResult.symbol.quantityAsset] = tradeMemo
    CacheProxy.put("Trades", JSON.stringify(trades))
  }

  private deleteTrade(tradeMemo: TradeMemo) {
    const trades = this.getTrades()
    delete trades[tradeMemo.tradeResult.symbol.quantityAsset]
    CacheProxy.put("Trades", JSON.stringify(trades))
  }

  dumpChanges() {
    this.set("trade", this.getTrades())
  }

}

export type Config = {
  KEY?: string
  SECRET?: string
  StableCoin: StableUSDCoin
  BuyQuantity: number
  StopLimit: number
  /**
   * When ProfitBasedStopLimit is true - a stop limit for each asset is calculated based on the total profit of the tool.
   * All profit is divided equally between all assets and this amount is how much loss is allowed for each asset.
   * Such stop limits are always recalculated when the total profit or number of assets changes.
   * Overrides {@link StopLimit}.
   */
  ProfitBasedStopLimit: boolean
  ProfitLimit: number
  SellAtStopLimit: boolean
  SellAtProfitLimit: boolean
  SwingTradeEnabled: boolean
  PriceProvider: PriceProvider
  /**
   * When averaging down is enabled, all the money gained from selling is used to buy more your existing
   * most unprofitable (in percentage) asset.
   * If you have assets A, B (-10% loss) and C(-15% loss) and A is sold, the tool will buy more
   * of C, and C loss will be averaged down, for example to -7%.
   * Next time, if C turns profitable and is sold, the tool will buy more of B.
   * This way, **if the price decline is temporary** for all of your assets,
   * the tool will gradually sell all assets without loss.
   */
  AveragingDown: boolean
  /**
   * When price suddenly drops for more than or equal percentage - an alert is sent.
   */
  DumpAlertPercentage?: number;
  /**
   * If true - buy the price dump automatically when {@link DumpAlertPercentage} alert happens.
   */
  BuyDumps?: boolean;

  /**
   * @deprecated
   */
  PriceAsset?: string
  /**
   * @deprecated
   */
  TakeProfit?: number
  /**
   * @deprecated
   */
  LossLimit?: number
  /**
   * @deprecated
   */
  SellAtTakeProfit?: boolean
}

export const DefaultStore = (this as any)['DefaultStore'] = new FirebaseStore()
