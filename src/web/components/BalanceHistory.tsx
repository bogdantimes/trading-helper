import * as React from "react";
import {
  Alert,
  Avatar,
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { f2, formatUSDCurrency } from "../../lib";
import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import BasicCard from "./cards/BasicCard";
import { cardMaxWidth, cardMinWidth } from "./Common";

export function BalanceHistory({ stats, currentPnL }) {
  const rows = buildRows(stats);

  return (
    <BasicCard>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Avatar sx={{ bgcolor: `transparent` }}>💸</Avatar>
        <Typography variant="h6">Balance History</Typography>
      </Stack>
      <Box sx={{ mt: 2 }}>
        <Alert severity="info">
          Balance changes since Day 1 with exchange fees taken into account.
          {` `}Represents the net profit/loss.
        </Alert>
        <List sx={{ minWidth: cardMinWidth, maxWidth: cardMaxWidth }}>
          {rows.map((r, i) => {
            const value = i === 0 ? r.profit + currentPnL : r.profit;
            const icon =
              value >= 0 ? (
                <ArrowDropUp color={`success`} />
              ) : (
                <ArrowDropDown color={`error`} />
              );
            return (
              <ListItem key={i} sx={{ padding: `0 16px` }}>
                <ListItemAvatar>{icon}</ListItemAvatar>
                <ListItemText
                  primary={formatUSDCurrency(value)}
                  secondary={r.timeFrame}
                />
              </ListItem>
            );
          })}
        </List>
      </Box>
    </BasicCard>
  );
}

function buildRows(stats) {
  const rows: any[] = [];

  if (stats) {
    const { TotalProfit: tp, TotalWithdrawals: tw, DailyProfit } = stats;
    const totalLabel = getTotalLabel(tw);
    rows.push({ id: 1, timeFrame: totalLabel, profit: f2(tp) });

    const dailyRows = Object.keys(DailyProfit)
      .sort((a, b) => (new Date(a) < new Date(b) ? 1 : -1))
      .map((d, i) => ({
        id: i + 2,
        timeFrame: d,
        profit: f2(DailyProfit[d]),
      }));

    rows.push(...dailyRows);
  }

  return rows;
}

function getTotalLabel(tw) {
  return (
    <>
      Total (incl. cur. assets)
      <br />
      <Tooltip
        title={
          <>
            To add a profit withdrawal, use the API console. This action will
            decrease the free balance by the entered amount and update the bot's
            total profit. This is useful for tracking profit withdrawals.
          </>
        }
        arrow
      >
        <Typography
          component="span"
          variant={`inherit`}
          sx={{
            textDecoration: `underline`,
            textDecorationStyle: `dashed`,
          }}
          aria-label="withdrawals-tooltip"
        >
          Withdrawals
        </Typography>
      </Tooltip>
      {`: $${f2(tw)}`}
    </>
  );
}
