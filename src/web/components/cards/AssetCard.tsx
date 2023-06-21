import React from "react";
import {
  Box,
  darken,
  lighten,
  LinearProgress,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  type Config,
  floor,
  getPrecision,
  SHORT_MASK,
  type TradeMemo,
  TradeState,
} from "../../../lib/index";
import { growthIconMap } from "../Common";
import BasicCard from "./BasicCard";
import ImbalanceChecker from "../small/ImbalanceChecker";
import LockIcon from "@mui/icons-material/Lock";

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

  return (
    <BasicCard>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography
          variant="h6"
          fontWeight="bold"
          display="flex"
          alignItems="center"
        >
          {coinName} {!!tm.currentValue && growthIconMap.get(tm.getPriceMove())}
          {` `}
          {tm.locked && (
            <Tooltip
              arrow
              title={
                <Typography fontSize={`0.8rem`}>
                  The lock indicates that the trade is currently being
                  processed. If the lock remains active indefinitely, giving the
                  impression that the asset is stuck, please restart the bot
                  (API: `start`).
                </Typography>
              }
            >
              <LockIcon fontSize={`small`} color={`info`} />
            </Tooltip>
          )}
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
        {!!tm.tradeResult.entryPrice && (
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="inherit" fontWeight="bold" mr={`5px`}>
              {tm.tradeResult.soldPrice ? `Exit price:` : `Entry price:`}
            </Typography>
            <Typography variant="inherit">
              {floor(
                tm.tradeResult.soldPrice || tm.tradeResult.entryPrice,
                getPrecision(tm.currentPrice)
              )}
            </Typography>
          </Box>
        )}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="inherit" fontWeight="bold" mr={`5px`}>
            Paid:
          </Typography>
          <Typography variant="inherit">
            {displayPaid} {cfg.StableCoin}
          </Typography>
        </Box>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="inherit" fontWeight="bold" mr={`5px`}>
            {isSold ? `Gained:` : `Current:`}
          </Typography>
          <Typography variant="inherit">
            {displayCurrentValue} {cfg.StableCoin}
          </Typography>
        </Box>
        {!!tm.currentValue && (
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="inherit" fontWeight="bold" mr={`5px`}>
              Confidence:
            </Typography>
            <ImbalanceChecker
              coinName={coinName}
              initialValue={tm.supplyDemandImbalance}
              valueFormatter={(v: number) =>
                v && v * Math.min(1, 1 - tm.imbalanceThreshold() / v)
              }
              displayFormatter={(v: number) =>
                Math.max(0, Math.min(1, v + 0.5))
              }
            />
          </Box>
        )}
      </Typography>
      {tm.stateIs(TradeState.BUY) && (
        <LinearProgress
          sx={{
            width: `120%`,
            left: `-20px`,
            bottom: `-20px`,
            [`& .MuiLinearProgress-bar`]: { animationDuration: `5s` },
          }}
        />
      )}
    </BasicCard>
  );
};

export default AssetCard;
