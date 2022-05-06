import * as React from "react";
import Trade from "./Trade";
import {TradeMemo, TradeState} from "../../apps-script/TradeMemo";
import {Badge, Button, Grid, Stack, TextField, ToggleButton, ToggleButtonGroup} from "@mui/material";
import {Config} from "../../apps-script/Store";
import {gsr} from "../App";
import {useEffect} from "react";

const byProfit = (t1: TradeMemo, t2: TradeMemo): number => t1.profit() < t2.profit() ? 1 : -1;

const groupByState = (trades: { [key: string]: TradeMemo }): Map<TradeState, TradeMemo[]> => {
  const groupsMap = Object.keys(TradeState).reduce((map, key) => {
    map.set(TradeState[key], []);
    return map;
  }, new Map<TradeState, TradeMemo[]>());

  Object.values(trades).forEach(obj => {
    const tradeMemo = TradeMemo.fromObject(obj);
    groupsMap.get(tradeMemo.getState()).push(tradeMemo);
  });

  return groupsMap;
}

export function Assets({config}: { config: Config }) {
  const [trades, setTrades] = React.useState<{ [k: string]: TradeMemo }>({});

  useEffect(() => {
    gsr.withSuccessHandler(setTrades).getTrades();
    const interval = setInterval(gsr.withSuccessHandler(setTrades).getTrades, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, []);

  const [state, setState] = React.useState<TradeState>(TradeState.BOUGHT);
  const changeState = (e, newState) => setState(newState);

  const [coinName, setCoinName] = React.useState("BTC");

  function buy() {
    if (confirm(`Are you sure you want to buy ${coinName}?`)) {
      gsr.withSuccessHandler(alert).buyCoin(coinName);
    }
  }

  const tradesMap = groupByState(trades);
  const sx = {width: "332px"};
  return (
    <Grid sx={{flexGrow: 1}} container spacing={2}>
      <Grid item xs={12}>
        <Grid container justifyContent="center" spacing={2}>
          <Grid item>
            <ToggleButtonGroup sx={{...sx, height: '56px'}} fullWidth={true} color="primary" value={state} exclusive
                               onChange={changeState}>
              <ToggleButton value={TradeState.BOUGHT}>
                <Badge badgeContent={tradesMap.get(TradeState.BOUGHT).length}>Bought</Badge>
              </ToggleButton>
              <ToggleButton value={TradeState.SOLD}>
                <Badge badgeContent={tradesMap.get(TradeState.SOLD).length}>Sold</Badge>
              </ToggleButton>
              <ToggleButton value={TradeState.SELL}>
                <Badge badgeContent={tradesMap.get(TradeState.SELL).length}>Selling</Badge>
              </ToggleButton>
              <ToggleButton value={TradeState.BUY}>
                <Badge badgeContent={tradesMap.get(TradeState.BUY).length}>Buying</Badge>
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
          <Grid item>
            <Stack sx={sx} direction={"row"} spacing={2}>
              <TextField fullWidth={true} label="Coin name" value={coinName}
                         onChange={(e) => setCoinName(e.target.value)}/>
              <Button variant="contained" onClick={buy}>Buy</Button>
            </Stack>
          </Grid>
        </Grid>
      </Grid>
      <Grid item xs={12}>
        <Grid container justifyContent="center" spacing={2}>
          {tradesMap.has(state) && tradesMap.get(state).sort(byProfit).map(t =>
            <Grid item>
              <Trade key={t.tradeResult.symbol.quantityAsset}
                     name={t.tradeResult.symbol.quantityAsset} data={t} config={config}/>
            </Grid>
          )}
        </Grid>
      </Grid>
    </Grid>
  );
}
