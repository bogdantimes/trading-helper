import { ScoresData } from "trading-helper-lib"

export interface IScores {
  get(): ScoresData

  update(): void

  reset(): void
}
