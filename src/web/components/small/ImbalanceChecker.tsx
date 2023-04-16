import React, { useEffect, useState } from "react";
import { darken, Typography, useTheme } from "@mui/material";
import RefreshButton from "../small/RefreshButton";
import { type CandidateInfo, type CoinName, f0 } from "../../../lib/index";
import { percentileToColorMap, ScriptApp } from "../Common";

interface Props {
  coinName: CoinName;
  initialValue: number;
  ci?: CandidateInfo;
  formatter?: (v: number) => number;
}

const ImbalanceChecker = ({ coinName, initialValue, ci, formatter }: Props) => {
  const theme = useTheme();
  const [imbalance, setImbalance] = useState(initialValue);
  const [imbalanceFetching, setImbalanceFetching] = useState(false);

  useEffect(() => {
    setImbalance(initialValue);
  }, [initialValue]);

  function refreshImbalance() {
    setImbalanceFetching(true);
    ScriptApp?.withSuccessHandler((value) => {
      setImbalanceFetching(false);
      setImbalance(+value);
    })
      .withFailureHandler(() => {
        setImbalanceFetching(false);
      })
      .getImbalance(coinName, ci as any);
  }

  const color = percentileToColorMap[(imbalance + 0.5).toFixed(1)];
  const displayValue = f0((formatter ? formatter(imbalance) : imbalance) * 100);
  return (
    <Typography
      variant="inherit"
      display="flex"
      alignItems="center"
      color={theme.palette.mode === `light` ? darken(color, 0.5) : color}
    >
      {!!displayValue && `${displayValue}%`}
      <RefreshButton
        isSpinning={imbalanceFetching}
        onClick={refreshImbalance}
      />
    </Typography>
  );
};

export default ImbalanceChecker;
