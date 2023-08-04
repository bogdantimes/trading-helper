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

export interface NumberData {
  average: number;
  accuracy: number;
  percentile: number;
}

export interface CandidatesData {
  selected: Record<CoinName, CandidateInfo>;
  other: Record<CoinName, CandidateInfo>;
  mktDemand: NumberData;
}
