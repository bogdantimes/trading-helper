import * as React from "react"
import { useEffect } from "react"
import { Alert, Box, ListItem, ListItemAvatar, ListItemText, Stack } from "@mui/material"
import { FixedSizeList } from "react-window"
import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material"
import { Config, Stats } from "trading-helper-lib"
import { cardWidth } from "./Common"

export function Info({ config }: { config: Config }) {
  const [stats, setStats] = React.useState<Stats>(null)

  useEffect(() => {
    google.script.run.withSuccessHandler(setStats).getStatistics(config.profile as any)
  }, [])

  const rows = []

  if (stats) {
    rows.push({ id: 1, timeFrame: `Total`, profit: stats.TotalProfit })
    Object.keys(stats.DailyProfit)
      .sort((a, b) => (new Date(a) < new Date(b) ? 1 : -1))
      .forEach((d, i) => {
        rows.push({ id: i + 2, timeFrame: d, profit: stats.DailyProfit[d] })
      })
  }

  return (
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
      <Stack spacing={2}>
        <Alert sx={{ width: cardWidth }} severity={`info`}>
          The summary of realised profits and losses for each day and the total P/L since the
          beginning.
        </Alert>
        <FixedSizeList
          width={cardWidth}
          height={400}
          itemSize={55}
          itemCount={rows.length}
          overscanCount={5}
        >
          {({ index, style }) => {
            const up = rows[index].profit >= 0
            const icon = up ? <ArrowDropUp color={`success`} /> : <ArrowDropDown color={`error`} />
            return (
              <ListItem style={style} key={index} component="div">
                <ListItemAvatar>{icon}</ListItemAvatar>
                <ListItemText primary={rows[index].profit} secondary={rows[index].timeFrame} />
              </ListItem>
            )
          }}
        </FixedSizeList>
      </Stack>
    </Box>
  )
}
