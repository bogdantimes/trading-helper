import * as React from "react"
import { useEffect, useState } from "react"
import Trade from "./Trade"
import {
  Autocomplete,
  Button,
  Chip,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material"
import StableCoin from "./StableCoin"
import { capitalizeWord, cardWidth, circularProgress, confirmBuy } from "./Common"
import {
  AssetsResponse,
  Coin,
  CoinName,
  Config,
  StableUSDCoin,
  TradeMemo,
  TradeState,
} from "../../lib"

export function Assets({ config }: { config: Config }) {
  const [assets, setAssets] = React.useState<AssetsResponse>(null)
  const [coinName, setCoinName] = React.useState(`BTC`)
  const [coinNames, setCoinNames] = React.useState<CoinName[]>([])

  useEffect(() => {
    google.script.run.withSuccessHandler(setAssets).getAssets()
    const interval = setInterval(google.script.run.withSuccessHandler(setAssets).getAssets, 15000) // 15 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    google.script.run.withSuccessHandler(setCoinNames).getCoinNames()
  }, [])

  function buy() {
    if (confirmBuy(coinName, config)) {
      google.script.run.withSuccessHandler(alert).buyCoin(coinName)
    }
  }

  const tradesMap =
    assets &&
    assets.trades.reduce((map, obj) => {
      const tm = TradeMemo.fromObject(obj)
      map.has(tm.getState()) ? map.get(tm.getState()).push(tm) : map.set(tm.getState(), [tm])
      return map
    }, new Map<TradeState, TradeMemo[]>())

  return (
    <>
      <Grid sx={{ flexGrow: 1 }} container spacing={2}>
        <Grid item xs={12}>
          <Grid container justifyContent="center" spacing={2}>
            <Grid item>
              <Stack sx={{ width: cardWidth }} direction={`row`} spacing={2}>
                <Autocomplete
                  selectOnFocus={false}
                  value={coinName}
                  fullWidth={true}
                  options={coinNames}
                  onChange={(e, val) => setCoinName(val)}
                  disableClearable={true}
                  renderInput={(params) => <TextField {...params} label={`Coin Name`} />}
                />
                <Button variant="contained" onClick={buy}>
                  Buy
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Grid>
        {!assets && (
          <Grid item xs={12}>
            {circularProgress}
          </Grid>
        )}
        {getStableCoinViews(assets?.stableCoins)}
        {[TradeState.BUY, TradeState.SELL, TradeState.BOUGHT, TradeState.SOLD].map((s) =>
          getTradeViews(s, tradesMap?.get(s), config),
        )}
      </Grid>
    </>
  )
}

function getStableCoinViews(stableCoins?: Coin[]) {
  const [hide, setHide] = useState(false)

  const elements = stableCoins?.map((coin) => (
    <Grid key={coin.name} item>
      <StableCoin {...coin} />
    </Grid>
  ))
  const noElements = (
    <Grid item>
      <Typography variant="body1">
        No Stable Coins. First buy {Object.keys(StableUSDCoin).join(`, or `)} on Binance.
      </Typography>
    </Grid>
  )

  return (
    <>
      <Grid item xs={12}>
        <Divider>
          <Chip onClick={() => setHide(!hide)} label="Stable Coins" />
        </Divider>
      </Grid>
      {!hide && elements && (
        <Grid item xs={12}>
          <Grid container justifyContent="center" spacing={2}>
            {elements.length ? elements : noElements}
          </Grid>
        </Grid>
      )}
    </>
  )
}

function getTradeViews(state: TradeState, elems?: TradeMemo[], config?: Config) {
  // hide Sold trades by default, others visible by default
  const [hide, setHide] = useState(state === TradeState.SOLD)
  return (
    elems &&
    elems.length && (
      <>
        <Grid item xs={12}>
          <Divider>
            <Chip
              onClick={() => setHide(!hide)}
              label={`${capitalizeWord(state)} (${elems.length})`}
            />
          </Divider>
        </Grid>
        {!hide && (
          <Grid item xs={12}>
            <Grid container justifyContent="center" spacing={2}>
              {elems
                ?.sort((t1, t2) => (t1.profit() < t2.profit() ? 1 : -1))
                .map((t) => (
                  <Grid key={t.getCoinName()} item>
                    <Trade data={t} config={config} />
                  </Grid>
                ))}
            </Grid>
          </Grid>
        )}
      </>
    )
  )
}
