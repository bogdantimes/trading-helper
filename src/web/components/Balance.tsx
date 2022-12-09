import * as React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CurrencyFormat from "react-currency-format";
import {
  BNB,
  BNBFee,
  SHORT_MASK,
  StableCoinKeys,
  StableUSDCoin,
} from "../../lib/index";
import Tooltip from "@mui/material/Tooltip/Tooltip";

type Balances = { [key in StableCoinKeys | typeof BNB]?: number };

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
  const stableBalance = balances[name] >= 0 ? balances[name] : 0;
  const bnbStableBalance = balances.BNB >= 0 ? balances.BNB : 0;
  const total = stableBalance + assetsValue;
  const approxTradesCoveredByBNB = Math.max(
    0,
    Math.floor(bnbStableBalance / (total * BNBFee * 2))
  );
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
              title="Approximate number of trades with commissions covered by BNB available in the account. Recommended to keep some BNB on Binance to pay less fees and not accumulate small non-sold balances that are not tracked by the bot."
              arrow
            >
              <b
                style={{
                  textDecoration: `underline`,
                  textDecorationStyle: `dashed`,
                }}
              >
                BNB cover:
              </b>
            </Tooltip>
            <span style={{ float: `right` }}>
              ~ {hide ? SHORT_MASK : approxTradesCoveredByBNB} trade(s)
            </span>
          </div>
        </Typography>
      </CardContent>
    </Card>
  );
}
