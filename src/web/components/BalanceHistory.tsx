import * as React from "react";
import {
  Alert,
  Avatar,
  Box,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { f2, formatUSDCurrency } from "../../lib";
import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import HomeCard from "./cards/HomeCard";

export function BalanceHistory({ stats }) {
  const rows = buildRows(stats);

  return (
    <HomeCard>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Avatar sx={{ bgcolor: `transparent` }}>💸</Avatar>
        <Typography variant="h6">Balance History</Typography>
      </Stack>
      <Box sx={{ mt: 2 }}>
        <Alert severity="info">
          Balance changes since Day 1 with exchange fees taken into account.
          {` `}Represents the net profit/loss.
        </Alert>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Profit/Loss</TableCell>
                <TableCell>Time Frame</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Typography
                      display={`flex`}
                      color={row.profit >= 0 ? `success.main` : `error.main`}
                    >
                      {row.profit >= 0 ? (
                        <ArrowDropUp color="inherit" />
                      ) : (
                        <ArrowDropDown color="inherit" />
                      )}
                      {formatUSDCurrency(row.profit)}
                    </Typography>
                  </TableCell>
                  <TableCell>{row.timeFrame}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </HomeCard>
  );
}

function buildRows(stats) {
  const rows: any[] = [];

  if (stats) {
    const { TotalProfit: tp, TotalWithdrawals: tw, DailyProfit } = stats;
    const totalTimeFrame = getTotalLabelComponent(tw);
    rows.push({ id: 1, timeFrame: totalTimeFrame, profit: f2(tp) });

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

function getTotalLabelComponent(tw) {
  return (
    <>
      Total (
      <Tooltip
        title={
          <>
            To add a profit withdrawal, double tap (i) tab icon and enter
            (example) `addWithdrawal 100` in the API console . This action will
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
          aria-label="withdrawals-tooltip"
        >
          withdrawals
        </Typography>
      </Tooltip>
      : ${f2(tw)})
    </>
  );
}
