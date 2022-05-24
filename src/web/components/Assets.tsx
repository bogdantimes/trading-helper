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
import { Config } from "../../gas/Store"
import StableCoin from "./StableCoin"
import { capitalizeWord, circularProgress, confirmBuy } from "./Common"
import { TradeMemo } from "../../shared-lib/TradeMemo"
import { Coin, ExchangeSymbol, StableUSDCoin, TradeState } from "../../shared-lib/types"
import { Add } from "@mui/icons-material"
import { TradeEditDialog } from "./TradeEditDialog"
import { AssetsResponse } from "../../shared-lib/responses"

export function Assets({ config }: { config: Config }) {
  const [assets, setAssets] = React.useState<AssetsResponse>(null)
  const [coinName, setCoinName] = React.useState(`BTC`)
  const [coinNames, setCoinNames] = React.useState([] as string[])
  const [addCoin, setAddCoin] = useState(false)

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
              <Stack sx={{ width: `332px` }} direction={`row`} spacing={2}>
                <Autocomplete
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
                <Button variant="outlined" onClick={() => setAddCoin(true)}>
                  <Add />
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
        {assets && getStableCoinViews(assets.stableCoins)}
        {[TradeState.BUY, TradeState.SELL, TradeState.BOUGHT, TradeState.SOLD].map((s) =>
          getTradeViews(capitalizeWord(s), tradesMap?.get(s), config, coinNames),
        )}
      </Grid>
      {addCoin && (
        <TradeEditDialog
          tradeMemo={TradeMemo.newManual(new ExchangeSymbol(coinName, config.StableCoin))}
          onClose={() => setAddCoin(false)}
          onCancel={() => setAddCoin(false)}
          onSave={(newTm) =>
            new Promise((resolve, reject) => {
              google.script.run
                .withSuccessHandler((resp) => {
                  alert(resp)
                  resolve(resp)
                })
                .withFailureHandler((err) => {
                  reject(err)
                })
                // @ts-ignore
                .editTrade(newTm.getCoinName(), newTm)
            })
          }
        />
      )}
    </>
  )
}

function getStableCoinViews(stableCoins: Coin[]) {
  const [hide, setHide] = useState(false)

  const elements = stableCoins.map((coin) => (
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
      <Grid item xs={12}>
        <Grid container justifyContent="center" spacing={2}>
          {elements.length ? elements : noElements}
        </Grid>
      </Grid>
    </>
  )
}

function getTradeViews(label: string, elems: TradeMemo[], config: Config, coinNames: string[]) {
  const [hide, setHide] = useState(false)
  return (
    elems &&
    elems.length && (
      <>
        <Grid item xs={12}>
          <Divider>
            <Chip onClick={() => setHide(!hide)} label={`${label} (${elems.length})`} />
          </Divider>
        </Grid>
        {!hide && (
          <Grid item xs={12}>
            <Grid container justifyContent="center" spacing={2}>
              {elems
                ?.sort((t1, t2) => (t1.profit() < t2.profit() ? 1 : -1))
                .map((t) => (
                  <Grid key={t.getCoinName()} item>
                    <Trade
                      tradeNotAllowed={!coinNames.includes(t.getCoinName())}
                      data={t}
                      config={config}
                    />
                  </Grid>
                ))}
            </Grid>
          </Grid>
        )}
      </>
    )
  )
}
