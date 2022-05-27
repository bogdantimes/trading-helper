export enum StableUSDCoin {
  USDT = `USDT`,
  USDC = `USDC`,
  BUSD = `BUSD`,
}

export type PriceMap = { [key: string]: number }

export type Stats = {
  TotalProfit: number
  DailyProfit: PriceMap
}

export enum PriceProvider {
  Binance = `Binance`,
  CoinStats = `CoinStats`,
}

export class ExchangeSymbol {
  readonly quantityAsset: string
  readonly priceAsset: string

  constructor(quantityAsset: string, priceAsset: string) {
    if (!quantityAsset) {
      throw Error(`Invalid quantityAsset: "${quantityAsset}"`)
    }
    if (!priceAsset) {
      throw Error(`Invalid priceAsset: "${priceAsset}"`)
    }
    this.quantityAsset = quantityAsset.toUpperCase()
    this.priceAsset = priceAsset.toUpperCase()
  }

  static fromObject(object: { quantityAsset: string; priceAsset: string }): ExchangeSymbol {
    return new ExchangeSymbol(object.quantityAsset, object.priceAsset)
  }

  toString(): string {
    return this.quantityAsset + this.priceAsset
  }
}

export enum TradeState {
  BUY = `buy`,
  BOUGHT = `bought`,
  SELL = `sell`,
  SOLD = `sold`,
}

export class Coin {
  readonly name: string
  readonly balance: number

  constructor(name: string, balance = 0) {
    if (!name) throw new Error(`Invalid coin name: "${name}"`)
    this.name = name.toUpperCase()
    this.balance = Math.max(balance, 0)
  }

  isStable(): boolean {
    return Object.keys(StableUSDCoin).includes(this.name)
  }
}

export enum PriceMove {
  STRONG_DOWN,
  DOWN,
  NEUTRAL,
  UP,
  STRONG_UP,
}

export type MarketMove = {
  [PriceMove.STRONG_DOWN]: number
  [PriceMove.DOWN]: number
  [PriceMove.NEUTRAL]: number
  [PriceMove.UP]: number
  [PriceMove.STRONG_UP]: number
}
