import * as React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CurrencyFormat from "react-currency-format";
import {
  BNBFee,
  SHORT_MASK,
  type StableCoinKeys,
  type StableUSDCoin,
} from "../../lib/index";
import Tooltip from "@mui/material/Tooltip/Tooltip";
import { Alert } from "@mui/material";

type Balances = { [key in StableCoinKeys | `feesBudget`]?: number };

interface BalanceProps {
  name: StableUSDCoin;
  balances: Balances;
  assetsValue: number;
  hide: boolean;
}

export default function Balance({
  name,
  balances,
  assetsValue,
  hide,
}: BalanceProps): JSX.Element {
  const stableBalance = balances[name] ?? 0;
  const feesBudget = balances.feesBudget ?? 0;
  const total = stableBalance + assetsValue;
  const feeCover = Math.max(0, Math.floor(feesBudget / (total * BNBFee * 2)));
  const feesWarn =
    feeCover < 3
      ? `Fees budget is low. You can replenish in the Settings.`
      : ``;
  return (
    <Card sx={{ width: `240px` }}>
      <CardContent sx={{ ":last-child": { paddingBottom: `16px` } }}>
        <Typography variant="h5">{name}</Typography>
        <Typography variant="body2" color="text.secondary">
          <div>
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
          </div>
          <div>
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
          </div>
          <div>
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
          </div>
          <div>
            <Tooltip
              title="Approximate number of trades w/ fees covered by BNB available in the account. Recommended to keep some BNB on Binance to pay less fees and not accumulate small non-sold balances that are not tracked by Trading Helper."
              arrow
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
                  padding: 0,
                  marginTop: `5px`,
                  fontSize: `0.8rem`,
                  ".MuiAlert-message": { padding: 0 },
                }}
              >
                {feesWarn}
              </Alert>
            )}
          </div>
        </Typography>
      </CardContent>
    </Card>
  );
}
