import { type ExchangeSymbol, type TradeResult } from "../lib";

export interface IExchange {
  getBalance: (assetName: string) => number;

  marketBuy: (symbol: ExchangeSymbol, cost: number) => TradeResult;

  marketSell: (symbol: ExchangeSymbol, quantity: number) => TradeResult;

  importTrade: (symbol: ExchangeSymbol, qty?: number) => TradeResult;

  getLatestKlineOpenPrices: (
    symbol: ExchangeSymbol,
    interval: string,
    limit: number
  ) => number[];

  quantityForLotStepSize: (symbol: ExchangeSymbol, quantity: number) => number;

  getPricePrecision: (symbol: ExchangeSymbol) => number;
}
