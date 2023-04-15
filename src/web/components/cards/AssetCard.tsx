import React from "react";
import { Box, darken, lighten, Typography, useTheme } from "@mui/material";
import {
  type Config,
  f0,
  SHORT_MASK,
  type TradeMemo,
  TradeState,
} from "../../../lib/index";
import { growthIconMap, percentileToColorMap } from "../Common";
import HomeCard from "./HomeCard";

interface Params {
  cfg: Config;
  tm: TradeMemo;
  hideBalances: boolean;
}

const AssetCard = ({ cfg, tm, hideBalances }: Params) => {
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

  const supplyColor =
    percentileToColorMap[(tm.supplyDemandImbalance + 0.5).toFixed(1)];
  return (
    <HomeCard>
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
            {isSold ? `Gained:` : `Current:`}
          </Typography>
          <Typography variant="inherit">
            {displayCurrentValue} {cfg.StableCoin}
          </Typography>
        </Box>
        {!!tm.supplyDemandImbalance && (
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="inherit" fontWeight="bold">
              Market demand:
            </Typography>
            <Typography
              variant="inherit"
              color={
                theme.palette.mode === `light`
                  ? darken(supplyColor, 0.5)
                  : supplyColor
              }
            >
              {f0(tm.supplyDemandImbalance * 100)}%
            </Typography>
          </Box>
        )}
      </Typography>
    </HomeCard>
  );
};

export default AssetCard;