import { IExchange } from "./Exchange"
import { execute, Log } from "./Common"
import { ExchangeSymbol, getPrecision, PriceMap, floor, TradeResult } from "../lib"
import URLFetchRequestOptions = GoogleAppsScript.URL_Fetch.URLFetchRequestOptions

type ExchangeInfo = {
  symbols: [{ symbol: string; filters: [{ filterType: `LOT_SIZE`; stepSize: string }] }]
}

export class Binance implements IExchange {
  private readonly key: string
  private readonly secret: string
  private readonly attempts: number = 5
  private readonly interval: number = 100
  private readonly numberOfAPIServers = 5 // 5 distinct addresses were verified.
  private readonly defaultReqOpts: URLFetchRequestOptions
  private readonly tradeReqOpts: URLFetchRequestOptions
  private readonly serverIds: number[]
  readonly #balances: { [coinName: string]: number } = {}

  #exchangeInfo: ExchangeInfo

  constructor(key: string, secret: string) {
    this.key = key ?? ``
    this.secret = secret ?? ``
    this.defaultReqOpts = { headers: { "X-MBX-APIKEY": this.key }, muteHttpExceptions: true }
    this.tradeReqOpts = Object.assign({ method: `post` }, this.defaultReqOpts)
    this.serverIds = this.shuffleServerIds()
  }

  getPrices(): PriceMap {
    Log.debug(`Fetching prices from Binance`)
    try {
      const prices: { symbol: string; price: string }[] = this.fetch(
        () => `ticker/price`,
        this.defaultReqOpts,
      )
      Log.debug(`Got ${prices.length} prices`)
      return prices.reduce<PriceMap>((acc, p) => {
        const spotPrice = !p.symbol.match(/^\w+(UP|DOWN|BEAR|BULL)\w+$/)
        spotPrice && (acc[p.symbol] = +p.price)
        return acc
      }, {})
    } catch (e: any) {
      throw new Error(`Failed to get prices: ${e.message}`)
    }
  }

  getPrice(symbol: ExchangeSymbol): number {
    const resource = `ticker/price`
    const query = `symbol=${symbol}`
    try {
      const ticker = this.fetch(() => `${resource}?${query}`, this.defaultReqOpts)
      Log.debug(ticker)
      return +ticker.price
    } catch (e: any) {
      throw new Error(`Failed to get price for ${symbol}: ${e.message}`)
    }
  }

  getBalance(coinName: string): number {
    if (this.#balances[coinName]) {
      return this.#balances[coinName]
    }
    const resource = `account`
    const query = ``
    try {
      const accountData = this.fetch(
        () => `${resource}?${this.addSignature(query)}`,
        this.defaultReqOpts,
      )
      accountData.balances.forEach((balance: any) => {
        this.#balances[balance.asset] = +(balance.free || 0)
      })
    } catch (e: any) {
      throw new Error(`Failed to get available ${coinName}: ${e.message}`)
    }
    return +(this.#balances[coinName] || 0)
  }

  #updateBalance(coinName: string, amount: number): void {
    const balance = this.#balances[coinName] || 0
    this.#balances[coinName] = balance + amount
  }

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult {
    const moneyAvailable = this.getBalance(symbol.priceAsset)
    if (moneyAvailable < cost) {
      return new TradeResult(
        symbol,
        `Not enough money to buy: ${symbol.priceAsset}=${moneyAvailable}`,
      )
    }
    Log.alert(`➕ Buying ${symbol.quantityAsset} for ${cost} ${symbol.priceAsset}`)
    const query = `symbol=${symbol}&type=MARKET&side=BUY&quoteOrderQty=${cost}`
    try {
      const tradeResult = this.marketTrade(symbol, query)
      tradeResult.paid = tradeResult.cost
      this.#updateBalance(symbol.priceAsset, -tradeResult.cost)
      Log.alert(tradeResult.toTradeString())
      return tradeResult
    } catch (e: any) {
      if (e.message.includes(`Market is closed`)) {
        return new TradeResult(symbol, `Market is closed for ${symbol}.`)
      }
      throw e
    }
  }

  /**
   * Sells specified quantity or all available asset.
   * @param symbol
   * @param quantity
   */
  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult {
    const qty = this.#qtyForLotStepSize(symbol, quantity)
    const query = `symbol=${symbol}&type=MARKET&side=SELL&quantity=${qty}`
    Log.alert(`➖ Selling ${qty} ${symbol.quantityAsset} for ${symbol.priceAsset}`)
    try {
      const tradeResult = this.marketTrade(symbol, query)
      tradeResult.gained = tradeResult.cost
      tradeResult.soldPrice = tradeResult.price
      this.#updateBalance(symbol.priceAsset, tradeResult.cost)
      Log.alert(tradeResult.toTradeString())
      return tradeResult
    } catch (e: any) {
      if (e.message.includes(`Account has insufficient balance`)) {
        return new TradeResult(symbol, `Account has no ${qty} of ${symbol.quantityAsset}`)
      }
      if (e.message.includes(`Market is closed`)) {
        return new TradeResult(symbol, `Market is closed for ${symbol}.`)
      }
      if (e.message.includes(`MIN_NOTIONAL`)) {
        return new TradeResult(
          symbol,
          `The cost of ${symbol.quantityAsset} is less than minimal needed to sell it.`,
        )
      }
      throw e
    }
  }

  #qtyForLotStepSize(symbol: ExchangeSymbol, quantity: number) {
    if (!this.#exchangeInfo) {
      this.#exchangeInfo = this.fetch(() => `exchangeInfo`, this.defaultReqOpts)
    }

    const stepSize = this.#exchangeInfo.symbols
      .find((s) => s.symbol === symbol.toString())
      ?.filters.find((f) => f.filterType === `LOT_SIZE`)?.stepSize
    const precision = stepSize ? getPrecision(+stepSize) : 0

    return floor(quantity, precision)
  }

  marketTrade(symbol: ExchangeSymbol, query: string): TradeResult {
    try {
      const order = this.fetch(() => `order?${this.addSignature(query)}`, this.tradeReqOpts)
      Log.debug(order)
      const tradeResult = new TradeResult(symbol)
      const fees = this.#getFees(symbol, order.fills)
      tradeResult.quantity = +order.origQty - fees.origQty
      tradeResult.cost = +order.cummulativeQuoteQty - fees.quoteQty
      tradeResult.commission = fees.BNB
      tradeResult.fromExchange = true
      return tradeResult
    } catch (e: any) {
      throw new Error(`Failed to trade ${symbol}: ${e.message}`)
    }
  }

  #getFees(
    symbol: ExchangeSymbol,
    fills: any[] = [],
  ): { BNB: number; origQty: number; quoteQty: number } {
    const fees = { BNB: 0, origQty: 0, quoteQty: 0 }
    fills.forEach((f) => {
      if (f.commissionAsset == `BNB`) {
        fees.BNB += +f.commission
      } else if (f.commissionAsset == symbol.quantityAsset) {
        fees.origQty += +f.commission
      } else if (f.commissionAsset == symbol.priceAsset) {
        fees.quoteQty += +f.commission
      }
    })
    return fees
  }

  private addSignature(data: string) {
    const timestamp = Number(new Date().getTime()).toFixed(0)
    const sigData = `${data}${data ? `&` : ``}timestamp=${timestamp}`
    const sig = Utilities.computeHmacSha256Signature(sigData, this.secret)
      .map((e) => {
        const v = (e < 0 ? e + 256 : e).toString(16)
        return v.length == 1 ? `0` + v : v
      })
      .join(``)

    return `${sigData}&signature=${sig}`
  }

  fetch(resource: () => string, options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions): any {
    return execute({
      interval: this.interval,
      attempts: this.attempts,
      runnable: () => {
        const index = this.getNextServerIndex()
        const server = `https://api${index}.binance.com/api/v3`
        const resp = UrlFetchApp.fetch(`${server}/${resource()}`, options)

        if (resp.getResponseCode() === 200) {
          try {
            return JSON.parse(resp.getContentText())
          } catch (e: any) {
            throw new Error(`Failed to parse response from Binance: ${resp.getContentText()}`)
          }
        }

        if (resp.getResponseCode() === 418 || resp.getResponseCode() === 429) {
          Log.debug(`Limit reached on server ` + server)
        }

        if (
          resp.getResponseCode() === 400 &&
          resp.getContentText().includes(`Not all sent parameters were read`)
        ) {
          // Likely a request signature verification timeout
          Log.debug(`Got 400 response code from ` + server)
        }

        throw new Error(`${resp.getResponseCode()} ${resp.getContentText()}`)
      },
    })
  }

  private shuffleServerIds() {
    return Array.from(Array(this.numberOfAPIServers).keys())
      .map((i) => i + 1)
      .sort(() => Math.random() - 0.5)
  }

  private getNextServerIndex(): number {
    // take first server from the list and move it to the end
    const index = this.serverIds.shift() as number
    this.serverIds.push(index)
    return index
  }
}
