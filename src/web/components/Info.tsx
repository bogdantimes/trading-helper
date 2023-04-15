import * as React from "react";
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import CurrencyFormat from "react-currency-format";
import { f2, type Stats } from "../../lib";
import { cardMaxWidth, cardMinWidth } from "./Common";

export function Info({ stats }: { stats: Stats }): JSX.Element {
  const rows: Array<{
    id: number;
    timeFrame: JSX.Element | string;
    profit: number;
  }> = [];

  if (stats) {
    const { TotalProfit: tp, TotalWithdrawals: tw, DailyProfit } = stats;
    const totalTimeFrame = getTotalLabelComponent(tw);
    rows.push({ id: 1, timeFrame: totalTimeFrame, profit: f2(tp) });
    Object.keys(DailyProfit)
      .sort((a, b) => (new Date(a) < new Date(b) ? 1 : -1))
      .forEach((d, i) => {
        rows.push({
          id: i + 2,
          timeFrame: d,
          profit: f2(DailyProfit[d]),
        });
      });
  }

  return (
    <Box
      sx={{
        display: `flex`,
        justifyContent: `center`,
        mt: 2,
        mb: 2,
        maxWidth: cardMaxWidth,
        minWidth: cardMinWidth,
      }}
    >
      <Stack spacing={2}>
        <Alert severity="info">
          Balance changes since Day 1 with exchange fees taken into account.
          Represents the net profit/loss 💸.
        </Alert>
        <Card>
          <CardContent>
            <List>
              {rows.map((row) => {
                const profit = row.profit;
                const up = profit >= 0;
                const icon = up ? (
                  <ArrowDropUp color="success" />
                ) : (
                  <ArrowDropDown color="error" />
                );
                return (
                  <ListItem key={row.id} disablePadding>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: `transparent` }}>{icon}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <CurrencyFormat
                          value={profit}
                          displayType="text"
                          thousandSeparator
                          decimalScale={2}
                          fixedDecimalScale
                          prefix={profit >= 0 ? `+$` : `$`}
                        />
                      }
                      secondary={
                        <Typography variant="body2">{row.timeFrame}</Typography>
                      }
                    />
                  </ListItem>
                );
              })}
            </List>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

function getTotalLabelComponent(tw: number): React.ReactElement {
  return (
    <>
      Total (
      <Tooltip
        title={
          <>
            To add a profit withdrawal, double tap (i) tab icon and enter
            (example) `addWithdrawal 100` in the API console. This action will
            reduce the free balance by the amount entered and update the total
            profit of the bot. This is useful for tracking profit withdrawals.
          </>
        }
        arrow
      >
        <Typography
          component="span"
          sx={{
            textDecoration: `underline`,
            textDecorationStyle: `dashed`,
          }}
        >
          withdrawals
        </Typography>
      </Tooltip>
      : ${f2(tw)})
    </>
  );
}
