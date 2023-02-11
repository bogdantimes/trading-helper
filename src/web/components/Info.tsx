import * as React from "react";
import {
  Alert,
  Box,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Tooltip,
} from "@mui/material";
import { FixedSizeList } from "react-window";
import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";
import CurrencyFormat from "react-currency-format";
import { f2, type Stats } from "../../lib";
import { cardWidth } from "./Common";

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
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
      <Stack spacing={2}>
        <Alert sx={{ width: cardWidth }} severity={`info`}>
          Balance changes since Day 1 with exchange fees taken into account.
          {` `}Represents the net profit/loss 💸.
        </Alert>
        <FixedSizeList
          width={cardWidth}
          height={440}
          itemSize={55}
          itemCount={rows.length}
          overscanCount={5}
        >
          {({ index, style }) => {
            const profit = rows[index].profit;
            const up = profit >= 0;
            const icon = up ? (
              <ArrowDropUp color={`success`} />
            ) : (
              <ArrowDropDown color={`error`} />
            );
            return (
              <ListItem style={style} key={index} component="div">
                <ListItemAvatar>{icon}</ListItemAvatar>
                <ListItemText
                  primary={
                    <CurrencyFormat
                      value={profit}
                      displayType={`text`}
                      thousandSeparator={true}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      prefix={profit >= 0 ? `+$` : `$`}
                    />
                  }
                  secondary={rows[index].timeFrame}
                />
              </ListItem>
            );
          }}
        </FixedSizeList>
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
        <span
          style={{
            textDecoration: `underline`,
            textDecorationStyle: `dashed`,
          }}
        >
          withdrawals
        </span>
      </Tooltip>
      : ${f2(tw)})
    </>
  );
}
