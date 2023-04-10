import React from "react";
import { Avatar, Box, Card, CardContent, Typography } from "@mui/material";
import { styled } from "@mui/system";
import { type Config, SHORT_MASK, type TradeMemo, TradeState } from "../../lib";

const palette = {
  [TradeState.BUY]: {
    background: `#F2F7FF`,
    text: `#0028FF`,
    border: `#DDE9FF`,
  },
  [TradeState.SELL]: {
    background: `#FFF4F4`,
    text: `#FF4646`,
    border: `#FFDADA`,
  },
  [TradeState.BOUGHT]: {
    background: `#F4F8E8`,
    text: `#41AF33`,
    border: `#D2E8B3`,
  },
  [TradeState.SOLD]: {
    background: `#F2F2F2`,
    text: `#8D8D8D`,
    border: `#BDBDBD`,
  },
};

const getTradeStateColor = (tradeState: TradeState) => {
  const { background } = palette[tradeState];
  return `linear-gradient(45deg, ${background} 30%, #FFFFFF 90%)`;
};

interface Params {
  cfg: Config;
  tm: TradeMemo;
}

const ProfitTypography = styled(Typography)(({ theme }) => ({
  borderRadius: `4px`,
  padding: theme.spacing(0.5, 1),
  fontWeight: `bold`,
}));

const CryptoCard = ({ cfg, tm }: Params) => {
  const coinName = tm.getCoinName();
  const paid = tm.tradeResult.paid;
  const currentValue = tm.currentValue || tm.tradeResult.gained;
  const profitPercent = tm.profitPercent();
  const displayPaid = cfg.HideBalances ? SHORT_MASK : paid.toFixed(2);
  const displayCurrentValue = cfg.HideBalances
    ? SHORT_MASK
    : currentValue.toFixed(2);
  const profitSign = profitPercent >= 0 ? `+` : `-`;
  const tradeState = tm.getState();
  const isSold = tradeState === TradeState.SOLD;

  const { text, border } = palette[tradeState];

  return (
    <Card
      sx={{
        minWidth: `230px`,
        boxShadow: 2,
        backgroundImage: getTradeStateColor(tradeState),
        color: text,
        position: `relative`,
        overflow: `hidden`,
        border: `1px solid ${border}`,
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center">
            <Avatar
              src={`/static/images/avatar/1.jpg`}
              alt={coinName}
              sx={{ marginRight: 1 }}
            />
            <Typography variant="h6" fontWeight="bold">
              {coinName}
            </Typography>
          </Box>
          <ProfitTypography
            variant="body1"
            color="inherit"
            sx={{
              backgroundColor:
                tradeState === TradeState.BUY
                  ? `rgba(0, 40, 255, 0.15)`
                  : tradeState === TradeState.SELL
                  ? `rgba(255, 70, 70, 0.15)`
                  : tradeState === TradeState.BOUGHT
                  ? `rgba(65, 175, 51, 0.15)`
                  : `rgba(141, 141, 141, 0.15)`,
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
            ~{displayCurrentValue} {cfg.StableCoin}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};
export default CryptoCard;
