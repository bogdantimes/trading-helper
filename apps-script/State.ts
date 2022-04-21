export type State = {
  trade: { [key: string]: Trade }
  Config: Config
  Statistics: Statistics
}

export type MarketSymbol = {
  /**
   * Prefix is the name of the coin, like BTC in BTCUSDT.
   */
  prefix: string
  /**
   * Suffix is the name of the coin that used to exchange the prefix, like USDT in BTCUSDT.
   */
  suffix: string
}

export type Trade = {
  state: TradeState

  symbol: ExchangeSymbol
  /**
   * The price of 1 coin.
   */
  price: number
  /**
   * The amount of bought or sold coins.
   */
  quantity: number
  /**
   * How much paid (commission added).
   */
  paid: number
  /**
   * How much gained (commission subtracted).
   */
  gained: number
}

export enum TradeState {
  BUYING = 'BUYING',
  HOLDING = 'HOLDING',
  SELLING = 'SELLING',
  SOLD = 'SOLD'
}

export type Config = {
  TakeProfit: number
  SellAtTakeProfit: boolean
  BuyQuantity: number
  LossLimit: number
  SECRET?: string
  KEY?: string
  PriceAsset: string
  SellAtStopLimit: boolean
  SwingTradeEnabled?: boolean
}

export type Statistics = {
  TotalProfit: number;
  DailyProfit: { [key: string]: number };
}
