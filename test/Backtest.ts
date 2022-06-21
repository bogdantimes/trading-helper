import { BinanceHistory } from "./BinanceHistory"
import { DefaultTrader } from "../src/gas/traders/DefaultTrader"
import { PriceProvider } from "../src/gas/PriceProvider"
import { Statistics } from "../src/gas/Statistics"
import { ConfigDao } from "../src/gas/dao/Config"
import { TradesDao } from "../src/gas/dao/Trades"
import { Log, LogLevel } from "../src/gas/Common"
import { ScoreTrader } from "../src/gas/traders/ScoreTrader"
import { AnomalyTrader } from "../src/gas/traders/AnomalyTrader"
import { InMemoryStore } from "./InMemoryStore"
import { InMemoryCache } from "./InMemoryCache"
import { Scores } from "./Scores"
import { TradeActions } from "../src/gas/TradeActions"
import { AutoTradeBestScores, StableUSDCoin } from "trading-helper-lib"
import { CoinNames } from "./CoinNames"
import { logUpdate } from "./helpers"
import * as fs from "fs"

test(new Date(`06-19-2022`), new Date(`06-20-2022`))

async function test(startDate: Date, endDate: Date) {
  if (isNaN(+startDate) || isNaN(+endDate)) {
    console.error(`Invalid start or end date`)
    return
  }
  if (startDate > endDate) {
    console.error(`Start date must be before end date`)
    return
  }
  if (endDate > new Date()) {
    console.error(`End date must be before today`)
    return
  }

  // Silence Log for better performance
  Log.level = LogLevel.NONE

  const exchange = new BinanceHistory()
  const fmtDate = (date: Date) => `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`
  const filePrefix = `${fmtDate(startDate)}_${fmtDate(endDate)}`

  const pricesFile = `${filePrefix}_prices.json`
  const scoresFile = `${filePrefix}_scores.json`

  const stableCoin = StableUSDCoin.BUSD
  await exchange.fetchPrices(CoinNames, stableCoin, startDate, endDate, pricesFile)

  const stepsNumber = exchange.readPricesFromFile(pricesFile)

  const cache = new InMemoryCache()
  const store = new InMemoryStore()
  const priceProvider = PriceProvider.getInstance(exchange, cache)

  const statistics = new Statistics(store)
  const configDao = new ConfigDao(store)
  const tradesDao = new TradesDao(store)
  const config = configDao.get()
  const scores = new Scores(store, priceProvider, config)

  config.StableCoin = stableCoin
  config.AutoTradeBestScores = AutoTradeBestScores.TOP5

  configDao.set(config)

  try {
    console.log(`Back-testing started`)
    console.log(`Config:\n${JSON.stringify(config, null, 2)}`)

    // run trader in infinite loop while there are prices to process
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const tradeActions = new TradeActions(store, config, priceProvider)

      // Update prices every tick. This should the only place to call `update` on the price provider.
      priceProvider.update()

      const trader = new DefaultTrader(store, exchange, priceProvider, statistics)

      tradesDao.getList().forEach((trade) => {
        try {
          tradesDao.update(trade.getCoinName(), (tm) => trader.tickerCheck(tm))
        } catch (e) {
          Log.error(e)
        }
      })

      try {
        trader.updateStableCoinsBalance()
      } catch (e) {
        Log.alert(`Failed to read stable coins balance`)
        Log.error(e)
      }

      try {
        scores.update()
      } catch (e) {
        Log.alert(`Failed to update scores`)
        Log.error(e)
      }

      try {
        new ScoreTrader(store, scores, tradeActions).trade()
      } catch (e) {
        Log.alert(`Failed to trade recommended coins`)
        Log.error(e)
      }

      try {
        new AnomalyTrader(store, cache, priceProvider).trade()
      } catch (e) {
        Log.alert(`Failed to trade price anomalies`)
        Log.error(e)
      }

      logUpdate(`Step ${exchange.step()}/${stepsNumber}`)
      cache.step()
    }
  } catch (e: any) {
    console.log(`\n`)
    console.error(e.message)
  }

  console.log(`Unfinished trades: ${tradesDao.getList().length}`)
  console.log(
    `Unfinished trades P/L: ${tradesDao
      .getList()
      .map((t) => t.profit())
      .reduce((a, b) => a + b, 0)}`,
  )
  console.log(`Total profit: ${statistics.getAll().TotalProfit}`)

  // Write scores to JSON file
  const scoresJson = JSON.stringify(store.get(`SurvivorScores`), null, 2)
  fs.writeFileSync(scoresFile, scoresJson)
  console.log(`Scores written to ${scoresFile}`)
}
