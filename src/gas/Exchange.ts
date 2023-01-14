import { Binance } from "./Binance";
import { ExchangeSymbol, TradeResult } from "../lib";
import { APIKeysProvider } from "./dao/Config";

export interface IExchange {
  getBalance: (assetName: string) => number;

  marketBuy: (symbol: ExchangeSymbol, cost: number) => TradeResult;

  marketSell: (symbol: ExchangeSymbol, quantity: number) => TradeResult;

  getLatestKlineOpenPrices: (
    symbol: ExchangeSymbol,
    interval: string,
    limit: number
  ) => number[];

  quantityForLotStepSize: (symbol: ExchangeSymbol, quantity: number) => number;

  getImbalance: (
    symbol: ExchangeSymbol,
    limit: number,
    bidCutOffPrice: number
  ) => number;

  getPricePrecision: (symbol: ExchangeSymbol) => number;
}

export class Exchange implements IExchange {
  private readonly exchange: Binance;

  constructor(provider: APIKeysProvider) {
    this.exchange = new Binance(provider);
  }

  quantityForLotStepSize(symbol: ExchangeSymbol, quantity: number): number {
    return this.exchange.quantityForLotStepSize(symbol, quantity);
  }

  getBalance(assetName: string): number {
    return this.exchange.getBalance(assetName);
  }

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult {
    return this.exchange.marketBuy(symbol, cost);
  }

  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult {
    return this.exchange.marketSell(symbol, quantity);
  }

  getLatestKlineOpenPrices(
    symbol: ExchangeSymbol,
    interval: string,
    limit: number
  ): number[] {
    return this.exchange.getLatestKlineOpenPrices(symbol, interval, limit);
  }

  getImbalance(
    symbol: ExchangeSymbol,
    limit: number,
    bidCutOffPrice: number
  ): number {
    return this.exchange.getImbalance(symbol, limit, bidCutOffPrice);
  }

  getPricePrecision(symbol: ExchangeSymbol): number {
    return this.exchange.getPricePrecision(symbol);
  }
}
