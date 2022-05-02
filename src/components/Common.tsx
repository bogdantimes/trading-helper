import {CircularProgress} from "@mui/material";
import * as React from "react";

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
