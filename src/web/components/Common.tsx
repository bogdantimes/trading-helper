import { Alert, CircularProgress, Link, Typography } from "@mui/material"
import * as React from "react"
import { Config, PriceMove, ScoreSelectivityKeys } from "../../lib"
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  KeyboardDoubleArrowDown,
  KeyboardDoubleArrowUp,
} from "@mui/icons-material"
import { AlertColor } from "@mui/material/Alert/Alert"

export const circularProgress = (
  <>
    <CircularProgress
      size={24}
      sx={{
        position: `absolute`,
        top: `50%`,
        left: `50%`,
        marginTop: `-12px`,
        marginLeft: `-12px`,
      }}
    />
  </>
)

const map = new Map<PriceMove, JSX.Element>()
map.set(PriceMove.STRONG_DOWN, <KeyboardDoubleArrowDown htmlColor={`red`} />)
map.set(PriceMove.DOWN, <KeyboardArrowDown htmlColor={`red`} />)
map.set(
  PriceMove.NEUTRAL,
  <KeyboardArrowUp htmlColor={`lightblue`} sx={{ transform: `rotate(90deg)` }} />,
)
map.set(PriceMove.UP, <KeyboardArrowUp htmlColor={`green`} />)
map.set(PriceMove.STRONG_UP, <KeyboardDoubleArrowUp htmlColor={`green`} />)
export const growthIconMap = map

export const confirmBuy = (coinName: string, config: Config) =>
  confirm(`Are you sure you want to buy ${coinName} for ${config.StableCoin}?`)

export const confirmSell = (coinName: string, config: Config) =>
  confirm(
    `Are you sure you want to sell ${coinName} and get ${config.StableCoin}? ${
      config.AveragingDown
        ? `Averaging down is enabled. All gained money will be re-invested into the most unprofitable coin.`
        : ``
    }`,
  )

export const capitalizeWord = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

export const cardWidth = `332px`

export const selectivityColorMap: { [key in ScoreSelectivityKeys]: AlertColor } = {
  EXTREME: `error`,
  HIGH: `warning`,
  MODERATE: `info`,
  MINIMAL: `success`,
}

export function featureDisabledInfo() {
  return (
    <Alert severity="info">
      <Typography variant="body1">
        <Link
          href="https://www.patreon.com/bePatron?u=52791105"
          target="_blank"
          rel="noopener noreferrer"
        >
          Become a Patron!
        </Link>
        {` `}to unlock the functionality.
      </Typography>
      <Typography variant="caption">
        <b>Important: use the same Google account in Patreon.</b>
      </Typography>
    </Alert>
  )
}
