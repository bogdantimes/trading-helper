import * as React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { f2 } from "../../lib";
import { cardWidth } from "./Common";

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
    <>
      <Card sx={{ width: cardWidth }}>
        <CardContent sx={{ ":last-child": { paddingBottom: `16px` } }}>
          <Typography variant="h5">{name}</Typography>
          <Typography variant="body2" color="text.secondary">
            <div>Free: {f2(balance)}</div>
            <div>Assets Value: {f2(assetsValue)}</div>
            <div>Total: {f2(balance + assetsValue)}</div>
          </Typography>
        </CardContent>
      </Card>
    </>
  );
}
