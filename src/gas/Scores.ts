import { ScoresData } from "../shared-lib/types"

export interface IScores {
  get(): ScoresData

  update(): void

  reset(): void
}
