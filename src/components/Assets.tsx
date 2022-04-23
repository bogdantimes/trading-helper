import * as React from "react";
import {useEffect} from "react";
import Box from "@mui/material/Box";
import Trade from "./Trade";
import {TradeMemo, TradeState} from "../../apps-script/TradeMemo";
import {ToggleButton, ToggleButtonGroup} from "@mui/material";

const byProfit = (t1: TradeMemo, t2: TradeMemo): number => t1.maxProfit < t2.maxProfit ? 1 : -1;

const filterByState = (trades, state: TradeState): TradeMemo[] => {
  return Object.values(trades).map(TradeMemo.fromObject).filter(t => t.stateIs(state));
};

// @ts-ignore
const gsr = google.script.run;

export function Assets() {
  const [config, setConfig] = React.useState({});
  const [trades, setTrades] = React.useState<{ [k: string]: TradeMemo }>({});

  function fetchData() {
    gsr.withSuccessHandler(setConfig).getConfig()
    gsr.withSuccessHandler(setTrades).getTrades()
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const [state, setState] = React.useState<TradeState>(TradeState.BOUGHT);
  const changeState = (e, newState) => setState(newState);

  return (
    <>
      <Box sx={{margin: '10px'}}>
        <ToggleButtonGroup color="primary" value={state} exclusive onChange={changeState}>
          <ToggleButton value={TradeState.BOUGHT}>Bought</ToggleButton>
          <ToggleButton value={TradeState.SOLD}>Sold</ToggleButton>
          <ToggleButton value={TradeState.SELL}>Selling</ToggleButton>
          <ToggleButton value={TradeState.BUY}>Buying</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      {filterByState(trades, state).sort(byProfit).map((trade) =>
        <Box sx={{display: 'inline-flex', margin: '10px'}}>
          <Trade key={trade.tradeResult.symbol.quantityAsset}
                 name={trade.tradeResult.symbol.quantityAsset} data={trade} config={config}/>
        </Box>
      )}
    </>
  );
}
