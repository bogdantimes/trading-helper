import React from "react";
import {
  Box,
  Card,
  CardContent,
  darken,
  lighten,
  Typography,
  useTheme,
} from "@mui/material";
import { styled } from "@mui/system";
import { type Config, SHORT_MASK, type TradeMemo, TradeState } from "../../lib";
import { cardWidth, growthIconMap } from "./Common";

interface Params {
  cfg: Config;
  tm: TradeMemo;
  hideBalances: boolean;
}

const ProfitTypography = styled(Typography)(({ theme }) => ({
  borderRadius: `4px`,
  padding: theme.spacing(0.5, 1),
  fontWeight: `bold`,
}));

const CryptoCard = ({ cfg, tm, hideBalances }: Params) => {
  const theme = useTheme();
  const coinName = tm.getCoinName();
  const paid = tm.tradeResult.paid;
  const currentValue = tm.currentValue || tm.tradeResult.gained;
  const profitPercent = tm.profitPercent();
  const displayPaid = hideBalances ? SHORT_MASK : paid.toFixed(2);
  const profitReal = Math.abs(tm.profit());
  const profitSign = profitPercent >= 0 ? `+` : `-`;
  const displayCurrentValue = hideBalances
    ? SHORT_MASK
    : `${currentValue.toFixed(2)} (${profitSign}${profitReal.toFixed(2)})`;
  const tradeState = tm.getState();
  const isSold = tradeState === TradeState.SOLD;

  return (
    <Card
      sx={{
        minWidth: cardWidth,
        boxShadow: 2,
        color: `text.primary`,
        position: `relative`,
        overflow: `hidden`,
        borderColor: `divider`,
      }}
    >
      <CardContent sx={{ ":last-child": { paddingBottom: `16px` } }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h6"
            fontWeight="bold"
            display="flex"
            alignItems="center"
          >
            {coinName} {growthIconMap.get(tm.getPriceMove())}
          </Typography>
          <ProfitTypography
            variant="body1"
            color="inherit"
            sx={{
              backgroundColor: (theme.palette.mode === `light`
                ? lighten
                : darken)(
                profitPercent >= 0
                  ? theme.palette.success.light
                  : theme.palette.error.light,
                0.5
              ),
            }}
          >
            {profitSign}
            {Math.abs(profitPercent).toFixed(2)}%
          </ProfitTypography>
        </Box>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mt={1}
        >
          <Typography variant="body2" fontWeight="bold">
            Paid:
          </Typography>
          <Typography variant="body2">
            {displayPaid} {cfg.StableCoin}
          </Typography>
        </Box>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mt={1}
        >
          <Typography variant="body2" fontWeight="bold">
            {isSold ? `Sold for:` : `Current:`}
          </Typography>
          <Typography variant="body2">
            {displayCurrentValue} {cfg.StableCoin}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
export default CryptoCard;
