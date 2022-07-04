import * as React from "react"
import { useEffect } from "react"
import { Box, List, ListItem, ListItemAvatar, ListItemText, Stack, Typography } from "@mui/material"
import { cardWidth, circularProgress } from "./Common"
import { Config, f8, Key, PriceChannelsDataResponse } from "../../lib"

export function Channels({ config }: { config: Config }) {
  const [priceChannelsData, setPriceChannelsData] = React.useState<PriceChannelsDataResponse>(null)

  const reload = () => {
    google.script.run.withSuccessHandler(setPriceChannelsData).getPriceChannelsData()
  }

  useEffect(() => {
    reload()
    const interval = setInterval(reload, 1000 * 60)
    return () => clearInterval(interval)
  }, [])

  return (
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
      {!priceChannelsData && circularProgress}
      {priceChannelsData && <Stack spacing={2}>{list(priceChannelsData, config)}</Stack>}
    </Box>
  )
}

function list(data: PriceChannelsDataResponse, config: Config) {
  const keysSortedByDuration = Object.keys(data).sort(
    (a, b) => data[b][Key.DURATION] - data[a][Key.DURATION],
  )

  return (
    <>
      <Typography alignSelf={`center`} variant={`subtitle1`}>
        Price Channels
      </Typography>
      {!keysSortedByDuration.length && (
        <Typography alignSelf={`center`} variant={`body2`}>
          Nothing to show yet.
        </Typography>
      )}
      {!!keysSortedByDuration.length && (
        <Stack>
          <List
            sx={{ padding: 0, marginTop: 0, width: cardWidth, overflow: `auto`, maxHeight: 440 }}
          >
            {keysSortedByDuration.map((coin, i) => {
              const { [Key.DURATION]: duration, [Key.MIN]: min, [Key.MAX]: max } = data[coin]
              const dataHint = `${duration}/${config.ChannelWindowMins} | ${f8(min)} | ${f8(max)}`
              return (
                <ListItem
                  sx={{
                    padding: `0 0 6px 0`,
                  }}
                  key={i}
                  disablePadding={true}
                >
                  <ListItemAvatar sx={{ minWidth: `48px` }}>#{i + 1}</ListItemAvatar>
                  <ListItemText
                    sx={{ margin: `3px 0 0 0` }}
                    primary={coin + (duration > config.ChannelWindowMins ? ` ✅` : ``)}
                    secondary={dataHint}
                  />
                </ListItem>
              )
            })}
          </List>
        </Stack>
      )}
    </>
  )
}
