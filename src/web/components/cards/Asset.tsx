import React from "react";
import {
  Box,
  darken,
  lighten,
  LinearProgress,
  Typography,
  useTheme,
} from "@mui/material";
import {
  type Config,
  SHORT_MASK,
  type TradeMemo,
  TradeState,
} from "../../../lib/index";
import { growthIconMap } from "../Common";
import Home from "./Home";

interface Params {
  cfg: Config;
  tm: TradeMemo;
  hideBalances: boolean;
}

const Asset = ({ cfg, tm, hideBalances }: Params) => {
  const theme = useTheme();
  const coinName = tm.getCoinName();
  const paid = tm.tradeResult.paid;
  const currentValue = tm.currentValue || tm.tradeResult.gained;
  const profitPercent = tm.profitPercent();
  const displayPaid = hideBalances ? SHORT_MASK : paid.toFixed(2);
  const profitAbs = Math.abs(tm.profit());
  const profitSign = profitPercent >= 0 ? `+` : `-`;
  const displayCurrentValue = hideBalances
    ? SHORT_MASK
    : `${currentValue.toFixed(2)} (${profitSign}${profitAbs.toFixed(2)})`;
  const tradeState = tm.getState();
  const isSold = tradeState === TradeState.SOLD;

  return (
    <Home
      bColor={
        isSold
          ? tm.profit() >= 0
            ? `${theme.palette.success.main}`
            : `${theme.palette.error.main}`
          : ``
      }
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography
          variant="h6"
          fontWeight="bold"
          display="flex"
          alignItems="center"
        >
          {coinName} {growthIconMap.get(tm.getPriceMove())}
        </Typography>
        <Typography
          variant="body2"
          fontWeight="bold"
          borderRadius="4px"
          padding={theme.spacing(0.5, 1)}
          sx={{
            backgroundColor: (theme.palette.mode === `light`
              ? lighten
              : darken)(
              profitPercent >= 0
                ? theme.palette.success.light
                : theme.palette.error.light,
              0.6
            ),
          }}
        >
          {profitSign}
          {Math.abs(profitPercent).toFixed(2)}%
        </Typography>
      </Box>
      <Typography color="text.secondary" variant="body2" mt={1}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="inherit" fontWeight="bold">
            Paid:
          </Typography>
          <Typography variant="inherit">
            {displayPaid} {cfg.StableCoin}
          </Typography>
        </Box>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="inherit" fontWeight="bold">
            {isSold ? `Sold for:` : `Current:`}
          </Typography>
          <Typography variant="inherit">
            {displayCurrentValue} {cfg.StableCoin}
          </Typography>
        </Box>
      </Typography>
      {!isSold && (
        <LinearProgress
          value={100}
          variant={cfg.SmartExit ? `indeterminate` : `determinate`}
          sx={{ width: `120%`, left: `-20px`, bottom: `-20px` }}
        />
      )}
    </Home>
  );
};

export default Asset;
