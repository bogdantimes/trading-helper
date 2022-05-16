import {CircularProgress} from "@mui/material";
import * as React from "react";
import {Config} from "../../apps-script/Store";

export const circularProgress = <><CircularProgress size={24} sx={{
  position: 'absolute',
  top: '50%',
  left: '50%',
  marginTop: '-12px',
  marginLeft: '-12px'
}}/></>;

export function f2(n: number): number {
  return +n.toFixed(2)
}

export const confirmBuy = (coinName: string, config: Config) =>
  confirm(`Are you sure you want to buy ${coinName} for ${config.StableCoin}?`);

export const confirmSell = (coinName: string, config: Config) =>
  confirm(`Are you sure you want to sell ${coinName} and get ${config.StableCoin}? ${config.AveragingDown ? "Averaging down is enabled. All gained money will be re-invested into the most unprofitable coin." : ""}`);
