import * as React from "react";
import { useEffect, useState } from "react";
import Trade from "./Trade";
import { Chip, Divider, Grid } from "@mui/material";
import Balance from "./Balance";
import { capitalizeWord, circularProgress } from "./Common";
import {
  AssetsResponse,
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

  const invested: TradeMemo[] = [];
  assets?.trades.forEach((obj) => {
    if (obj.tradeResult.quantity > 0) {
      invested.push(TradeMemo.fromObject(obj));
    }
  });

  const assetsValue = invested.reduce((sum, tm) => {
    const qty = tm.tradeResult.quantity;
    return qty > 0 ? sum + qty * tm.currentPrice : sum;
  }, 0);

  return (
    <>
      <Grid sx={{ flexGrow: 1 }} container spacing={2}>
        {!assets && (
          <Grid item xs={12}>
            {circularProgress}
          </Grid>
        )}
        {getBalanceView(config.StableCoin, config.StableBalance, assetsValue)}
        {getTradeCards(TradeState.BOUGHT, invested, config)}
      </Grid>
    </>
  );
}

function getBalanceView(
  name: StableUSDCoin,
  balance: number,
  assetsValue: number
): JSX.Element {
  const [hide, setHide] = useState(false);

  return (
    <>
      <Grid item xs={12}>
        <Divider>
          <Chip onClick={() => setHide(!hide)} label="Balance" />
        </Divider>
      </Grid>
      {!hide && (
        <Grid item xs={12}>
          <Grid container justifyContent="center" spacing={2}>
            <Grid item>
              <Balance {...{ name, balance, assetsValue }} />
            </Grid>
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
