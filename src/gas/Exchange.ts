import { Binance } from "./Binance"
import { ExchangeSymbol, PriceMap, TradeResult } from "../lib"

export interface IExchange {
  getBalance(assetName: string): number

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult

  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult

  getPrices(): PriceMap

  getPrice(symbol: ExchangeSymbol): number
}

export class Exchange implements IExchange {
  private readonly exchange: Binance

  constructor(key: string, secret: string) {
    this.exchange = new Binance(key, secret)
  }

  getBalance(assetName: string): number {
    return this.exchange.getBalance(assetName)
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
}
