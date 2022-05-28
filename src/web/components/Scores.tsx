import * as React from "react"
import { useEffect } from "react"
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material"
import { Refresh } from "@mui/icons-material"
import { Config } from "../../gas/Store"
import { circularProgress, confirmBuy, growthIconMap } from "./Common"
import { CoinScore } from "../../shared-lib/CoinScore"
import { ScoresResponse } from "../../shared-lib/responses"
import { f2 } from "../../shared-lib/functions"
import { PriceMove } from "../../shared-lib/types"

export function Scores({ config }: { config: Config }) {
  const [scores, setScores] = React.useState<ScoresResponse>(null)

  useEffect(() => {
    google.script.run.withSuccessHandler(setScores).getScores()
  }, [])

  function buy(coinName: string) {
    if (confirmBuy(coinName, config)) {
      google.script.run.withSuccessHandler(alert).buyCoin(coinName)
    }
  }

  return (
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
      {!scores && circularProgress}
      {scores && (
        <Stack spacing={2}>
          {marketMoveBlock(scores)}
          {recommendedList(scores, buy)}
          <Stack alignSelf={`center`} spacing={2} direction={`row`}>
            {!!scores.recommended.length && (
              <Button
                onClick={() => {
                  if (confirm(`Are you sure you want to clear the scores?`)) {
                    google.script.run
                      .withSuccessHandler(() =>
                        setScores((prevState) => {
                          return {
                            ...prevState,
                            recommended: [],
                          }
                        }),
                      )
                      .resetScores()
                  }
                }}
              >
                Reset
              </Button>
            )}
            <IconButton
              onClick={() => {
                google.script.run.withSuccessHandler(setScores).getScores()
              }}
            >
              <Refresh />
            </IconButton>
          </Stack>
        </Stack>
      )}
    </Box>
  )
}

function recommendedList(scores: ScoresResponse, buy: (coinName: string) => void) {
  return (
    <>
      <Typography alignSelf={`center`} variant={`subtitle1`}>
        Recommended
      </Typography>
      {!scores.recommended.length && (
        <Typography alignSelf={`center`} variant={`caption`}>
          Nothing to show yet.
        </Typography>
      )}
      {!!scores.recommended.length && (
        <List sx={{ padding: 0, width: 332 }}>
          {scores.recommended.map((rJson, i) => {
            const cs = CoinScore.fromObject(rJson)
            return (
              <ListItem
                key={cs.coinName}
                disablePadding={true}
                secondaryAction={
                  <Button size={`small`} onClick={() => buy(cs.coinName)}>
                    Buy
                  </Button>
                }
              >
                <ListItemAvatar>#{i + 1}</ListItemAvatar>
                <ListItemText
                  sx={{ marginBottom: 0 }}
                  primary={cs.coinName}
                  secondary={`Score: ${cs.score}`}
                />
              </ListItem>
            )
          })}
        </List>
      )}
    </>
  )
}

function marketMoveBlock(scores: ScoresResponse) {
  return (
    <>
      <Typography alignSelf={`center`} variant={`subtitle1`}>
        Market Move
      </Typography>
      <Stack alignSelf={`center`} direction={`row`}>
        {Object.values(PriceMove)
          .reverse()
          .map(
            (m: PriceMove) =>
              growthIconMap.has(m) && (
                <Typography variant={`caption`} sx={{ display: `flex`, alignItems: `center` }}>
                  {growthIconMap.get(m)} {f2(scores.marketMove[m])} %
                </Typography>
              ),
          )}
      </Stack>
    </>
  )
}
