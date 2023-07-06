import { Log } from "./Common";
import {
  type ExchangeSymbol,
  execute,
  floor,
  getPrecision,
  INTERRUPT,
  type SymbolInfo,
  TradeResult,
} from "../lib";
import { type IExchange } from "./IExchange";
import { type APIKeysProvider } from "./dao/Config";

interface FeeRec {
  commission: number;
  commissionAsset: string;
}

export class Binance implements IExchange {
  private readonly serverIds: number[];
  readonly #balances: Record<string, number> = {};
  readonly #cloudURL: string;

  #curServerId: number;

  constructor(private readonly provider: APIKeysProvider) {
    this.serverIds = this.#shuffleServerIds();
    this.#curServerId = this.serverIds[0];
    this.#cloudURL = global.TradingHelperLibrary.getBinanceURL();
  }

  #getSymbolInfo(symbol: ExchangeSymbol): SymbolInfo | undefined {
    return global.TradingHelperLibrary.getBinanceSymbolInfo(symbol);
  }

  getBalance(coinName: string): number {
    if (this.#balances[coinName]) {
      return this.#balances[coinName];
    }
    const resource = `account`;
    const query = ``;
    try {
      const { key, secret } = this.#getAPIKeysOrDie();
      const accountData = this.fetch(
        () => `${resource}?${this.#addSignature(query, secret)}`,
        {
          headers: { "X-MBX-APIKEY": key },
          muteHttpExceptions: true,
        }
      );
      accountData.balances.forEach((balance: any) => {
        this.#balances[balance.asset] = +(balance.free || 0);
      });
    } catch (e: any) {
      throw new Error(`Failed to get available ${coinName}: ${e.message}`);
    }
    return +(this.#balances[coinName] || 0);
  }

  getLatestKlineOpenPrices(
    symbol: ExchangeSymbol,
    interval: string,
    limit: number
  ): number[] {
    Log.debug(
      `Fetching latest kline open prices for ${symbol}, interval: ${interval}, limit: ${limit}`
    );
    const resource = `klines`;
    const query = `symbol=${symbol}&interval=${interval}&limit=${limit}`;
    try {
      return this.fetch(() => `${resource}?${query}`, {}).map(
        (kline: any) => +kline[1]
      );
    } catch (e: any) {
      throw new Error(
        `Failed to get latest kline open prices for ${symbol}: ${e.message}`
      );
    }
  }

  #updateBalance(coinName: string, amount: number): void {
    const balance = this.#balances[coinName] || 0;
    this.#balances[coinName] = balance + amount;
  }

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult {
    const moneyAvailable = this.getBalance(symbol.priceAsset);
    if (moneyAvailable < cost) {
      return new TradeResult(
        symbol,
        `Not enough money to buy: ${symbol.priceAsset}=${moneyAvailable}`
      );
    }
    Log.alert(
      `➕ Buying ${symbol.quantityAsset} for ${cost} ${symbol.priceAsset}`
    );
    const query = `symbol=${symbol}&type=MARKET&side=BUY&quoteOrderQty=${cost}`;
    try {
      const tradeResult = this.marketTrade(symbol, query);
      tradeResult.paid = tradeResult.cost;
      this.#updateBalance(symbol.priceAsset, -tradeResult.cost);
      return tradeResult;
    } catch (e: any) {
      const msg = `❌ Couldn't buy ${symbol.quantityAsset}. Reason: ${e.message}`;
      Log.info(msg);
      return new TradeResult(symbol, msg);
    }
  }

  /**
   * Sells specified quantity or all available asset.
   * @param symbol
   * @param quantity
   */
  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult {
    const qty = this.quantityForLotStepSize(symbol, quantity);
    const query = `symbol=${symbol}&type=MARKET&side=SELL&quantity=${qty}`;
    Log.alert(
      `➖ Selling ${qty} ${symbol.quantityAsset} for ${symbol.priceAsset}`
    );
    try {
      const tradeResult = this.marketTrade(symbol, query);
      tradeResult.gained = tradeResult.cost;
      tradeResult.soldPrice = tradeResult.avgPrice;
      this.#updateBalance(symbol.priceAsset, tradeResult.cost);
      return tradeResult;
    } catch (e: any) {
      if (e.message.includes(`Account has insufficient balance`)) {
        return new TradeResult(
          symbol,
          `Account has no ${qty} of ${symbol.quantityAsset}`
        );
      }
      if (e.message.includes(`Market is closed`)) {
        return new TradeResult(symbol, `Market is closed for ${symbol}.`);
      }
      if (e.message.includes(`MIN_NOTIONAL`)) {
        return new TradeResult(
          symbol,
          `The cost of ${symbol.quantityAsset} is less than minimal needed to sell it.`
        );
      }
      throw e;
    }
  }

  quantityForLotStepSize(symbol: ExchangeSymbol, quantity: number): number {
    const precision = this.getLotSizePrecision(symbol);
    return floor(quantity, precision);
  }

  getLotSizePrecision(symbol: ExchangeSymbol): number {
    const lotSize = this.#getSymbolInfo(symbol)?.filters.find(
      (f) => f.filterType === `LOT_SIZE`
    );
    if (!lotSize?.stepSize) {
      throw new Error(`Failed to get LOT_SIZE for ${symbol}`);
    }
    return getPrecision(+lotSize.stepSize);
  }

  getPricePrecision(symbol: ExchangeSymbol): number {
    const priceFilter = this.#getSymbolInfo(symbol)?.filters.find(
      (f) => f.filterType === `PRICE_FILTER`
    );
    if (!priceFilter?.tickSize) {
      throw new Error(`Failed to get PRICE_FILTER for ${symbol}`);
    }
    return getPrecision(+priceFilter.tickSize);
  }

  marketTrade(symbol: ExchangeSymbol, query: string): TradeResult {
    try {
      const { key, secret } = this.#getAPIKeysOrDie();
      const order = this.fetch(
        () => `order?${this.#addSignature(query, secret)}`,
        {
          method: `post`,
          headers: { "X-MBX-APIKEY": key },
          muteHttpExceptions: true,
        }
      );
      Log.debug(order);
      const tradeResult = new TradeResult(symbol);
      const fees = this.#getFees(symbol, order.fills);
      tradeResult.quantity = +order.origQty - fees.origQty;
      tradeResult.cost = +order.cummulativeQuoteQty - fees.quoteQty;
      tradeResult.commission = fees.BNB;
      tradeResult.fromExchange = true;
      return tradeResult;
    } catch (e: any) {
      throw new Error(`Failed to trade ${symbol}: ${e.message}`);
    }
  }

  importTrade(symbol: ExchangeSymbol, qty?: number): TradeResult {
    const actualQty = this.getBalance(symbol.quantityAsset);

    if (!actualQty) {
      return new TradeResult(
        symbol,
        `Binance Sport portfolio does not have ${symbol.quantityAsset}`
      );
    }

    qty = qty || actualQty;

    if (qty > actualQty) {
      return new TradeResult(
        symbol,
        `Binance Sport portfolio has only ${actualQty} of ${symbol.quantityAsset}`
      );
    }

    const { cost, fees } = this.#getTotalCostForQuantity(symbol, qty);
    const tradeResult = new TradeResult(symbol);
    tradeResult.fromExchange = true;
    tradeResult.quantity = qty - fees.origQty;
    tradeResult.cost = cost - fees.quoteQty;
    tradeResult.commission = fees.BNB;
    tradeResult.paid = cost;

    return tradeResult;
  }

  #getTotalCostForQuantity(
    symbol: ExchangeSymbol,
    currentQuantity: number
  ): {
    fees: { BNB: number; origQty: number; quoteQty: number };
    cost: number;
  } {
    const { key, secret } = this.#getAPIKeysOrDie();
    const resource = `myTrades`;
    const query = `symbol=${symbol}&recvWindow=60000&limit=1000`;

    let trades: any[] = this.fetch(
      () => `${resource}?${this.#addSignature(query, secret)}`,
      {
        headers: { "X-MBX-APIKEY": key },
        muteHttpExceptions: true,
      }
    );

    trades = trades.filter((t) => t.isBuyer).reverse();

    Log.debug(trades);

    let remainingQuantity = currentQuantity;
    let totalCost = 0;

    const feeRecs: FeeRec[] = [];

    for (const trade of trades) {
      if (remainingQuantity <= 0) break;

      const tradeQuantity = parseFloat(trade.qty);
      const cost = parseFloat(trade.quoteQty);
      const feeRec: FeeRec = {
        commission: parseFloat(trade.commission),
        commissionAsset: trade.commissionAsset,
      };

      if (tradeQuantity > remainingQuantity) {
        const fraction = remainingQuantity / tradeQuantity;
        feeRec.commission *= fraction;
        totalCost += fraction * cost;
        remainingQuantity = 0;
      } else {
        totalCost += cost;
        remainingQuantity -= tradeQuantity;
      }

      feeRecs.push(feeRec);
    }

    if (remainingQuantity > 0) {
      throw new Error(
        `Trade history is insufficient to cover the requested quantity for ${symbol}`
      );
    }

    Log.debug(feeRecs);

    const fees = this.#getFees(symbol, feeRecs);
    return { cost: totalCost, fees };
  }

  #getFees(
    symbol: ExchangeSymbol,
    fills: any[] = []
  ): { BNB: number; origQty: number; quoteQty: number } {
    const fees = { BNB: 0, origQty: 0, quoteQty: 0 };
    fills.forEach((f) => {
      if (f.commissionAsset === `BNB`) {
        fees.BNB += +f.commission;
      } else if (f.commissionAsset === symbol.quantityAsset) {
        fees.origQty += +f.commission;
      } else if (f.commissionAsset === symbol.priceAsset) {
        fees.quoteQty += +f.commission;
      }
    });
    return fees;
  }

  #addSignature(data: string, secret: string): string {
    const timestamp = Number(new Date().getTime()).toFixed(0);
    const sigData = `${data}${data ? `&` : ``}timestamp=${timestamp}`;
    const sig = Utilities.computeHmacSha256Signature(sigData, secret)
      .map((e) => {
        const v = (e < 0 ? e + 256 : e).toString(16);
        return v.length === 1 ? `0` + v : v;
      })
      .join(``);

    return `${sigData}&signature=${sig}`;
  }

  #getAPIKeysOrDie(): { key: string; secret: string } {
    const { key, secret } = this.provider.getAPIKeys();
    if (!key || !secret) {
      throw new Error(`No Binance API Key or Secret configured.`);
    }
    return { key, secret };
  }

  fetch(
    resource: () => string,
    options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions
  ): any {
    const cloudURL = this.#cloudURL;
    return execute({
      interval: 200,
      attempts: cloudURL ? 2 : this.serverIds.length * 4,
      runnable: () => {
        const server =
          cloudURL || `https://api${this.#curServerId}.binance.com/api/v3/`;
        const resp = UrlFetchApp.fetch(
          `${server}${encodeURI(resource())}`,
          options
        );

        if (resp.getResponseCode() === 200) {
          try {
            return JSON.parse(resp.getContentText());
          } catch (e: any) {
            Log.debug(`Failed to parse response from Binance: ${e.message}`);
          }
        }

        this.#rotateServer();

        if (resp.getResponseCode() === 418 || resp.getResponseCode() === 429) {
          Log.debug(`Limit reached on Binance`);
        }

        if (resp.getResponseCode() === 451) {
          Log.alert(
            `⛔ Binance blocked the request because it originates from a restricted location (most likely US-based Google Apps Script server). TradingHelper has EU-based service which is automatically enabled for Patrons that unlocked the autonomous trading.`
          );
          throw new Error(
            `${INTERRUPT} ${resp.getResponseCode()} ${resp.getContentText()}`
          );
        }

        if (
          resp.getResponseCode() === 400 &&
          resp.getContentText().includes(`Not all sent parameters were read`)
        ) {
          // Likely a request signature verification timeout
          Log.debug(`Got 400 response code from Binance`);
        }

        throw new Error(`${resp.getResponseCode()} ${resp.getContentText()}`);
      },
    });
  }

  #shuffleServerIds(): number[] {
    // 3 distinct addresses were verified.
    return [1, 2, 3].sort(() => Math.random() - 0.5);
  }

  #rotateServer(): void {
    this.#curServerId = this.serverIds.shift() ?? this.#curServerId;
    this.serverIds.push(this.#curServerId);
  }
}
