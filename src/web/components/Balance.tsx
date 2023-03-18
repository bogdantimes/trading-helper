import * as React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CurrencyFormat from "react-currency-format";
import {
  BNBFee,
  MINIMUM_FEE_COVERAGE,
  SHORT_MASK,
  type StableCoinKeys,
  type StableUSDCoin,
} from "../../lib/index";
import Tooltip from "@mui/material/Tooltip/Tooltip";
import { Alert, Link } from "@mui/material";

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
    feeCover < MINIMUM_FEE_COVERAGE
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
              arrow
              title={
                <Typography fontSize={`0.8rem`}>
                  Estimated number of BNB-covered trades. Advised to maintain
                  BNB on Binance Spot account for reduced fees and avoiding
                  small unsold balances not tracked by Trading Helper. For more
                  information on BNB fees, visit:{` `}
                  <Link target={`_blank`} href={`https://binance.com/en/fee`}>
                    https://binance.com/en/fee
                  </Link>
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
          </div>
        </Typography>
      </CardContent>
    </Card>
  );
}
