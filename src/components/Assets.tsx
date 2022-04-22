import * as React from "react";
import {useEffect} from "react";
import Box from "@mui/material/Box";
import Trade from "./Trade";
import {TradeMemo} from "../../apps-script/TradeMemo";

const byProfit = trades => (k1, k2) => {
  const trade1: TradeMemo = trades[k1];
  const trade2: TradeMemo = trades[k2];
  return trade1.maxProfit < trade2.maxProfit ? 1 : -1;
};

export function Assets() {
  const [trades, setTrades] = React.useState({});
  // @ts-ignore
  useEffect(() => google.script.run.withSuccessHandler(setTrades).getTrades(), [])

  const [config, setConfig] = React.useState({});
  // @ts-ignore
  useEffect(() => google.script.run.withSuccessHandler(setConfig).getConfig(), [])

  return (
    <>
      {Object.keys(trades).sort(byProfit(trades)).map((key, index) =>
        <Box sx={{display: 'inline-flex', margin: '10px'}}>
          <Trade key={index} name={key} data={trades[key]} config={config}/>
        </Box>
      )}
    </>
  );
}
