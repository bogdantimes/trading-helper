import { Binance } from "./Binance";
import { ExchangeSymbol, TradeResult } from "../lib";

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

  getImbalance: (symbol: ExchangeSymbol, limit: number) => number;

  getPricePrecision: (symbol: any) => number;
}

export class Exchange implements IExchange {
  private readonly exchange: Binance;

  constructor(key: string, secret: string) {
    this.exchange = new Binance(key, secret);
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

  getImbalance(symbol: ExchangeSymbol, limit: number): number {
    return this.exchange.getImbalance(symbol, limit);
  }

  getPricePrecision(symbol: ExchangeSymbol): number {
    return this.exchange.getPricePrecision(symbol);
  }
}
