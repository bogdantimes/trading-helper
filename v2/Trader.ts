type PriceMemo = [number, number, number]

const blockedKey = (s: ExchangeSymbol) => `blocked/${s}`

class V2Trader implements Trader {
  private readonly store: IStore;
  private readonly exchange: IExchange;
  private readonly lossLimit: number;
  private readonly stats: Statistics;
  private readonly takeProfit: number;

  constructor(store: IStore, exchange: IExchange, stats: Statistics) {
    this.lossLimit = +store.getOrSet("LossLimit", "0.03")
    this.takeProfit = +store.getOrSet("TakeProfit", "0.2")
    this.store = store
    this.exchange = exchange
    this.stats = stats
  }

  buy(symbol: ExchangeSymbol, cost: number): TradeResult {
    const tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
    if (tradeMemo) {
      tradeMemo.tradeResult.msg = "Not buying. Asset is already tracked."
      tradeMemo.tradeResult.fromExchange = false
      return tradeMemo.tradeResult
    }

    if (CacheService.getScriptCache().get(blockedKey(symbol))) {
      return TradeResult.fromMsg(symbol, "Symbol is blocked after reaching MaxLosses")
    }

    try {
      const tradeResult = this.exchange.marketBuy(symbol, cost);
      this.store.delete(RetryBuying)

      if (tradeResult.fromExchange) {
        const stopLossPrice = tradeResult.price * (1 - this.lossLimit);
        const prices: PriceMemo = [tradeResult.price, tradeResult.price, tradeResult.price]
        const tradeMemo = new TradeMemo(tradeResult, stopLossPrice, prices);
        this.saveTradeMemo(tradeMemo)
        Log.alert(tradeResult.toString())
        Log.info(`${symbol} stopLossPrice saved: ${stopLossPrice}`)
        MultiTradeWatcher.watch(tradeMemo)
      }

      return tradeResult
    } catch (e) {
      this.store.set(RetryBuying, symbol.toString())
      ScriptApp.newTrigger(quickBuy.name).timeBased().after(5000).create()
      Log.info(`Scheduled quickBuy to retryBuying of ${symbol}`)
      throw e
    }
  }

  sell(symbol: ExchangeSymbol): TradeResult {
    let tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    if (tradeMemo.sell) {
      return this.sellAndClose(symbol, tradeMemo)
    }

    try {
      const price = tradeMemo.tradeResult.price;
      const currentPrice = this.exchange.getPrice(symbol);
      const takeProfitPrice = price * (1+this.takeProfit)
      if ((currentPrice < takeProfitPrice) && (currentPrice > tradeMemo.stopLossPrice)) {
        return TradeResult.fromMsg(symbol, `Not selling as price below take profit: ${takeProfitPrice}`)
      }
    } catch (e) {
      Log.error(e)
    }

    // Double-checking the trade memo is still present because it could have been removed in parallel by stopLossSell
    tradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }
    tradeMemo.sell = true;
    this.saveTradeMemo(tradeMemo)

    return this.sellAndClose(symbol, tradeMemo)
  }

  stopLossSell(symbol: ExchangeSymbol): TradeResult {

    const tradeMemo: TradeMemo = this.readTradeMemo(new TradeMemoKey(symbol));
    if (!tradeMemo) {
      return TradeResult.fromMsg(symbol, "Asset is not present")
    }

    if (tradeMemo.sell) {
      return this.sellAndClose(symbol, tradeMemo)
    }

    const currentPrice = this.exchange.getPrice(symbol);

    if (currentPrice <= tradeMemo.stopLossPrice) {
      Log.info(`Selling ${symbol} as current price '${currentPrice}' <= stop loss price '${tradeMemo.stopLossPrice}'`)
      return this.sellAndClose(symbol, tradeMemo)
    }

    tradeMemo.prices.shift()
    tradeMemo.prices.push(currentPrice)

    if (this.priceGoesUp(tradeMemo.prices)) {
      Log.info(`${symbol} price goes up`)
      // Using previous price to calculate new stop limit
      const newStopLimit = tradeMemo.prices[1] * (1 - this.lossLimit);
      tradeMemo.stopLossPrice = tradeMemo.stopLossPrice < newStopLimit ? newStopLimit : tradeMemo.stopLossPrice
    }

    tradeMemo.profitEstimate = tradeMemo.tradeResult.paid * (tradeMemo.stopLossPrice / tradeMemo.tradeResult.price - 1)
    this.saveTradeMemo(tradeMemo)

    Log.info(`${symbol} asset kept. Stop loss price: '${tradeMemo.stopLossPrice}'`)

    return TradeResult.fromMsg(symbol, "Keeping the asset.")
  }

  private sellAndClose(symbol: ExchangeSymbol, memo: TradeMemo) {
    const tradeResult = this.exchange.marketSell(symbol, memo.tradeResult.quantity);

    if (tradeResult.fromExchange) {
      tradeResult.profit = tradeResult.gained - memo.tradeResult.paid
      Log.alert(tradeResult.toString())
      if (tradeResult.profit > 0) {
        this.stats.bumpLossProfitMeter(symbol)
      } else {
        const lpMeter = this.stats.dumpLossProfitMeter(symbol);
        if (lpMeter <= 0) {
          const blockDurationMin = +this.store.getOrSet('BlockDurationMin', "240");
          CacheService.getScriptCache().put(blockedKey(symbol), "true", blockDurationMin*60)
          Log.info(`${symbol} blocked for ${blockDurationMin} minutes as loss-profit meter reached 0.`)
        }
      }
    }

    Log.debug(`Deleting memo from store: ${memo.getKey().toString()}`)
    this.store.delete(memo.getKey().toString())
    MultiTradeWatcher.unwatch(memo)

    return tradeResult
  }

  private readTradeMemo(key: TradeMemoKey): TradeMemo {
    const tradeMemoRaw = this.store.get(key.toString());
    if (tradeMemoRaw) {
      return TradeMemo.fromJSON(tradeMemoRaw)
    }
    return null
  }

  private saveTradeMemo(tradeMemo: TradeMemo) {
    this.store.set(tradeMemo.getKey().toString(), JSON.stringify(tradeMemo))
  }

  private priceGoesUp(lastPrices: PriceMemo): boolean {
    return lastPrices.every((value, index) => index == 0 ? true : value > lastPrices[index - 1])
  }

}
