import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { styled } from "@mui/system";
import { type Config, SHORT_MASK, type TradeMemo, TradeState } from "../../lib";

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
  const coinName = tm.getCoinName();
  const paid = tm.tradeResult.paid;
  const currentValue = tm.currentValue || tm.tradeResult.gained;
  const profitPercent = tm.profitPercent();
  const displayPaid = hideBalances ? SHORT_MASK : paid.toFixed(2);
  const displayCurrentValue = hideBalances
    ? SHORT_MASK
    : currentValue.toFixed(2);
  const profitSign = profitPercent >= 0 ? `+` : `-`;
  const tradeState = tm.getState();
  const isSold = tradeState === TradeState.SOLD;

  return (
    <Card
      sx={{
        minWidth: `230px`,
        boxShadow: 2,
        color: `text.primary`,
        position: `relative`,
        overflow: `hidden`,
        borderColor: `divider`,
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center">
            <Typography variant="h6" fontWeight="bold">
              {coinName}
            </Typography>
          </Box>
          <ProfitTypography
            variant="body1"
            color="inherit"
            sx={{
              backgroundColor: `rgba(0, 0, 0, 0.1)`,
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
          <Typography variant="body2">Paid:</Typography>
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
          <Typography variant="body2">
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
