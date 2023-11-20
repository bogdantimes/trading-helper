import { type CoinName } from "./IPriceProvider";
import { type TradeMemo } from "./TradeMemo";
import { type CandidateInfo, type Stats } from "./Types";
import { type Config } from "./Config";

export interface AppState {
  config: Config;
  assets: TradeMemo[];
  candidates: CandidatesData;
  info: Stats;
  firebaseURL: string;
}

export enum BullRun {
  No,
  Yes,
  Unknown,
}

export interface MarketInfo {
  averageDemand: number;
  accuracy: number;
  strength: number;
  bullRun: BullRun;
}

export interface CandidatesData {
  selected: Record<CoinName, CandidateInfo>;
  other: Record<CoinName, CandidateInfo>;
  marketInfo: MarketInfo;
}
