import { IExchange } from "../src/gas/Exchange"
import { ExchangeSymbol, PriceMap, StableUSDCoin, TradeResult } from "trading-helper-lib"
import { getKline, Kline } from "binance-historical"
import * as fs from "fs"
import { logUpdate } from "./helpers"

export class BinanceHistory implements IExchange {
  #index = 0
  #prices: { [key: string]: number[] } = {}

  readPricesFromFile(fileName = `prices.json`): number {
    let maxIndex = 0

    this.#prices = JSON.parse(fs.readFileSync(fileName, `utf8`))

    Object.values(this.#prices).forEach((p) => (maxIndex = Math.max(maxIndex, p.length)))

    // fill missing prices with 0
    Object.keys(this.#prices).forEach((symbol) => {
      while (this.#prices[symbol].length < maxIndex) {
        this.#prices[symbol].unshift(0)
      }
    })

    return maxIndex
  }

  async fetchPrices(
    coinNames: string[],
    stableCoin: StableUSDCoin,
    startDate: Date,
    endDate: Date,
    fileName: string,
  ) {
    this.#index = 0
    this.#prices = {}

    if (fs.existsSync(fileName)) {
      console.warn(`Prices file already exists: ${fileName}`)
      return
    }

    // append to file
    const file = fs.createWriteStream(fileName, { flags: `a` })

    file.write(`{\n`)

    // load coin prices in parallel in batches

    const batchSize = 8
    const batches = coinNames.reduce((acc, coinName, index) => {
      const batch = Math.floor(index / batchSize)
      acc[batch] = acc[batch] || []
      acc[batch].push(coinName)
      return acc
    }, [] as string[][])

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      logUpdate(`Fetching prices... Batch ${i + 1}/${batches.length}`)
      const promises = await Promise.all(
        batch.map(async (coinName) => {
          try {
            const symbol = `${coinName}${stableCoin}`
            const result: Array<Kline> = await getKline(symbol, `1m`, startDate, endDate)
            return { symbol, prices: result.map((k) => +k.open) }
          } catch (e: any) {
            console.error(e)
          }
        }),
      )
      promises.forEach((entry, y) => {
        if (!entry) return
        const coma = i < batches.length - 1 ? `,` : y < promises.length - 1 ? `,` : ``
        file.write(`"${entry.symbol}": ${JSON.stringify(entry.prices)}${coma}\n`)
      })
    }

    console.log(`\n`)

    file.write(`}\n`)
    await new Promise((fulfill) => file.close(fulfill))

    console.log(`Prices written to ${fileName}`)
  }

  step(): number {
    return ++this.#index
  }

  getFreeAsset(assetName: string): number {
    return 1000
  }

  getPrice(symbol: ExchangeSymbol): number {
    return this.#prices[symbol.toString()][this.#index]
  }

  getPrices(): PriceMap {
    const prices: PriceMap = {}
    Object.keys(this.#prices).forEach((symbol) => {
      const price = this.#prices[symbol][this.#index]
      if (price) {
        prices[symbol] = price
      }
    })
    if (Object.keys(prices).length === 0) {
      throw new Error(`No prices left.`)
    }
    return prices
  }

  marketBuy(symbol: ExchangeSymbol, cost: number): TradeResult {
    const tradeResult = new TradeResult(symbol)
    tradeResult.quantity = cost / this.getPrice(symbol)
    tradeResult.fromExchange = true

    // include Binance fees
    tradeResult.cost = cost * 1.001
    tradeResult.paid = tradeResult.cost

    return tradeResult
  }

  marketSell(symbol: ExchangeSymbol, quantity: number): TradeResult {
    const tradeResult = new TradeResult(symbol)
    tradeResult.quantity = quantity
    tradeResult.fromExchange = true

    // include Binance fees
    tradeResult.cost = quantity * this.getPrice(symbol) * 0.999
    tradeResult.gained = tradeResult.cost

    return tradeResult
  }
}
