import * as React from "react"
import { useEffect } from "react"
import {
  Alert,
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

  const infoMsg = `Score represents how many times a currency showed price growth, while ${
    (1 - config.ScoreGainersThreshold) * 100
  }% of the market was going in the opposite direction.`

  return (
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
      {!scores && circularProgress}
      {scores && (
        <Stack spacing={2}>
          <Alert sx={{ width: 332 }} severity={`info`}>
            {infoMsg}
          </Alert>
          {marketMoveBlock(scores)}
          {coinsList(scores, buy)}
          <Stack alignSelf={`center`} spacing={2} direction={`row`}>
            {!!scores.coins.length && (
              <Button
                onClick={() => {
                  if (confirm(`Are you sure you want to clear the scores?`)) {
                    google.script.run
                      .withSuccessHandler(() =>
                        setScores((prevState) => {
                          return {
                            ...prevState,
                            coins: [],
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

function coinsList(scores: ScoresResponse, buy: (coinName: string) => void) {
  return (
    <>
      <Typography alignSelf={`center`} variant={`subtitle1`}>
        Scores
      </Typography>
      {!scores.coins.length && (
        <Typography alignSelf={`center`} variant={`caption`}>
          Nothing to show yet.
        </Typography>
      )}
      {!!scores.coins.length && (
        <List sx={{ padding: 0, width: 332 }}>
          {scores.coins.map((rJson, i) => {
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
