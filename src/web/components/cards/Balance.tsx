import * as React from "react";
import Typography from "@mui/material/Typography";
import CurrencyFormat from "react-currency-format";
import {
  BNBFee,
  MINIMUM_FEE_COVERAGE,
  SHORT_MASK,
  type StableCoinKeys,
  type StableUSDCoin,
} from "../../../lib/index";
import Tooltip from "@mui/material/Tooltip/Tooltip";
import { Alert, Box, IconButton } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import Home from "./Home";

type Balances = { [key in StableCoinKeys | `feesBudget`]?: number };

interface BalanceProps {
  name: StableUSDCoin;
  balances: Balances;
  assetsValue: number;
  hide: boolean;
  toggleHide?: () => void;
  viewOnly: boolean;
}

export default function Balance({
  name,
  balances,
  assetsValue,
  hide,
  toggleHide,
  viewOnly,
}: BalanceProps): JSX.Element {
  const stableBalance = balances[name] ?? 0;
  const feesBudget = balances.feesBudget ?? 0;
  const total = stableBalance + assetsValue;
  const feeCover = Math.max(0, Math.floor(feesBudget / (total * BNBFee * 2)));
  const feesWarn =
    !viewOnly && feeCover < MINIMUM_FEE_COVERAGE
      ? `Fees budget is low. You can turn on replenishment in the Settings.`
      : ``;
  return (
    <Home>
      <Box
        style={{
          display: `flex`,
          justifyContent: `space-between`,
          alignItems: `center`,
        }}
      >
        <Typography variant="h5">{name}</Typography>
        {toggleHide && (
          <IconButton
            edge="end"
            onClick={() => {
              toggleHide();
            }}
          >
            {hide ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary">
        <Box>
          <b>Free:</b>
          {stableBalance === -1 && <span> Wait...</span>}
          {hide && <span style={{ float: `right` }}>${SHORT_MASK}</span>}
          {!hide && stableBalance !== -1 && (
            <CurrencyFormat
              style={{ float: `right` }}
              value={stableBalance}
              displayType={`text`}
              thousandSeparator={true}
              decimalScale={2}
              fixedDecimalScale={true}
              prefix={`$`}
            />
          )}
        </Box>
        <Box>
          <b>Assets:</b>
          {hide && <span style={{ float: `right` }}>${SHORT_MASK}</span>}
          {!hide && (
            <CurrencyFormat
              style={{ float: `right` }}
              value={assetsValue}
              displayType={`text`}
              thousandSeparator={true}
              decimalScale={2}
              fixedDecimalScale={true}
              prefix={`$`}
            />
          )}
        </Box>
        <Box>
          <b>Total:</b>
          {hide ? (
            <span style={{ float: `right` }}>${SHORT_MASK}</span>
          ) : (
            <CurrencyFormat
              style={{ float: `right` }}
              value={total}
              displayType={`text`}
              thousandSeparator={true}
              decimalScale={2}
              fixedDecimalScale={true}
              prefix={`$`}
            />
          )}
        </Box>
        <Box>
          <Tooltip
            arrow
            title={
              <Typography fontSize={`0.8rem`}>
                Estimated number of BNB-covered trades. Advised to maintain BNB
                on Binance Spot account for reduced fees and avoiding small
                unsold balances not tracked by Trading Helper.
              </Typography>
            }
          >
            <b
              style={{
                textDecoration: `underline`,
                textDecorationStyle: `dashed`,
              }}
            >
              Fees budget:
            </b>
          </Tooltip>
          <span style={{ float: `right` }}>
            ~ {hide ? SHORT_MASK : feeCover} trade(s)
          </span>
          {feesWarn && (
            <Alert
              icon={false}
              severity={`warning`}
              sx={{
                textAlign: `center`,
                padding: 0,
                marginTop: `5px`,
                fontSize: `0.8rem`,
                ".MuiAlert-message": { padding: 0 },
              }}
            >
              {feesWarn}
            </Alert>
          )}
        </Box>
      </Typography>
    </Home>
  );
}
