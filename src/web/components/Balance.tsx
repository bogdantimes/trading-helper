import * as React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CurrencyFormat from "react-currency-format";

interface BalanceProps {
  name: string;
  balance: number;
  assetsValue: number;
}

export default function Balance({
  name,
  balance,
  assetsValue,
}: BalanceProps): JSX.Element {
  return (
    <Card sx={{ width: `240px` }}>
      <CardContent sx={{ ":last-child": { paddingBottom: `16px` } }}>
        <Typography variant="h5">{name}</Typography>
        <Typography variant="body2" color="text.secondary">
          <div>
            <b>Free:</b>
            {balance === -1 ? (
              <span> Wait...</span>
            ) : (
              <CurrencyFormat
                style={{ float: `right` }}
                value={balance}
                displayType={`text`}
                thousandSeparator={true}
                decimalScale={2}
                fixedDecimalScale={true}
                prefix={`$`}
              />
            )}
          </div>
          <div>
            <b>Assets value:</b>
            <CurrencyFormat
              style={{ float: `right` }}
              value={assetsValue}
              displayType={`text`}
              thousandSeparator={true}
              decimalScale={2}
              fixedDecimalScale={true}
              prefix={`$`}
            />
          </div>
          <div>
            <b>Total:</b>
            <CurrencyFormat
              style={{ float: `right` }}
              value={balance >= 0 ? balance + assetsValue : assetsValue}
              displayType={`text`}
              thousandSeparator={true}
              decimalScale={2}
              fixedDecimalScale={true}
              prefix={`$`}
            />
          </div>
        </Typography>
      </CardContent>
    </Card>
  );
}
