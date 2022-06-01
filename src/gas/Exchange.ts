import { Binance } from "./Binance"
import { Config, ExchangeSymbol, PriceMap, StableUSDCoin, TradeResult } from "trading-helper-lib"

export interface IExchange {
  getFreeAsset(assetName: string): number

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult

  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult

  getPrices(): PriceMap

  getPrice(symbol: ExchangeSymbol): number
}

export class Exchange implements IExchange {
  private readonly exchange: Binance
  private readonly stableCoin: StableUSDCoin

  constructor(config: Config) {
    this.exchange = new Binance(config)
    this.stableCoin = config.StableCoin
  }

  getFreeAsset(assetName: string): number {
    return this.exchange.getFreeAsset(assetName)
  }

  getPrice(symbol: ExchangeSymbol): number {
    return this.getPrices()[symbol.toString()]
  }

  getPrices(): PriceMap {
    return this.exchange.getPrices()
  }

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult {
    return this.exchange.marketBuy(symbol, cost)
  }

  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult {
    return this.exchange.marketSell(symbol, quantity)
  }

  getCoinNames(): string[] {
    const coinNames = []
    Object.keys(this.exchange.getPrices()).forEach((symbol) => {
      if (symbol.endsWith(this.stableCoin)) {
        coinNames.push(symbol.split(this.stableCoin)[0])
      }
    })
    return coinNames
  }
}
