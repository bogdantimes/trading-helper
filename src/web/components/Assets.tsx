import * as React from "react";
import { useEffect, useState } from "react";
import Trade from "./Trade";
import { Chip, Divider, Grid, Typography } from "@mui/material";
import StableCoin from "./StableCoin";
import { capitalizeWord, circularProgress } from "./Common";
import {
  AssetsResponse,
  Coin,
  Config,
  StableUSDCoin,
  TradeMemo,
  TradeState,
} from "../../lib";

export function Assets({ config }: { config: Config }): JSX.Element {
  const [assets, setAssets] = React.useState<AssetsResponse>(null);

  useEffect(() => {
    google.script.run.withSuccessHandler(setAssets).getAssets();
    const interval = setInterval(
      google.script.run.withSuccessHandler(setAssets).getAssets,
      15000
    ); // 15 seconds
    return () => clearInterval(interval);
  }, []);

  const tradesMap = assets?.trades.reduce((map, obj) => {
    const tm = TradeMemo.fromObject(obj);
    map.has(tm.getState())
      ? map.get(tm.getState()).push(tm)
      : map.set(tm.getState(), [tm]);
    return map;
  }, new Map<TradeState, TradeMemo[]>());

  return (
    <>
      <Grid sx={{ flexGrow: 1 }} container spacing={2}>
        {!assets && (
          <Grid item xs={12}>
            {circularProgress}
          </Grid>
        )}
        {getStableCoinsView(assets?.stableCoins)}
        {[
          TradeState.BUY,
          TradeState.SELL,
          TradeState.BOUGHT,
          TradeState.SOLD,
        ].map((s) => getTradeCards(s, tradesMap?.get(s), config))}
      </Grid>
    </>
  );
}

function getStableCoinsView(stableCoins?: Coin[]): JSX.Element {
  const [hide, setHide] = useState(false);

  const elements = stableCoins?.map((coin) => (
    <Grid key={coin.name} item>
      <StableCoin {...coin} />
    </Grid>
  ));
  const noElements = (
    <Grid item>
      <Typography variant="body1">
        No Stable Coins. First buy {Object.keys(StableUSDCoin).join(`, or `)} on
        Binance.
      </Typography>
    </Grid>
  );

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
  );
}

function getTradeCards(
  state: TradeState,
  elems?: TradeMemo[],
  config?: Config
): JSX.Element {
  // hide Sold trades by default, others visible by default
  const [hide, setHide] = useState(state === TradeState.SOLD);
  return (
    elems?.length && (
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
  );
}
