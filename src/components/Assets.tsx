import * as React from "react";
import {useEffect} from "react";
import Box from "@mui/material/Box";
import Trade from "./Trade";

export function Assets() {
  const [trades, setTrades] = React.useState({});
  // @ts-ignore
  useEffect(() => google.script.run.withSuccessHandler(setTrades).getTrades(), [])

  const [config, setConfig] = React.useState({});
  // @ts-ignore
  useEffect(() => google.script.run.withSuccessHandler(setConfig).getConfig(), [])

  return (
    <>
      {Object.keys(trades).map((key, index) =>
        <Box sx={{display: 'inline-flex', margin: '10px'}}>
          <Trade key={index} name={key} data={trades[key]} config={config}/>
        </Box>
      )}
    </>
  );
}
