import * as React from "react"
import { useEffect } from "react"
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
  useTheme,
} from "@mui/material"
import {
  cardWidth,
  circularProgress,
  confirmBuy,
  growthIconMap,
  selectivityColorMap,
} from "./Common"
import { CoinScore, Config, f2, PriceMove, ScoresData } from "../../lib"

export function Scores({ config }: { config: Config }) {
  const [scoresData, setScoresData] = React.useState<ScoresData>(null)

  const updateScores = () => {
    google.script.run.withSuccessHandler(setScoresData).getScores()
  }

  function buy(coinName: string) {
    if (confirmBuy(coinName, config)) {
      google.script.run.withSuccessHandler(alert).buyCoin(coinName)
    }
  }

  useEffect(() => {
    updateScores()
    const interval = setInterval(updateScores, 1000 * 60)

    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
      {!scoresData && circularProgress}
      {scoresData && (
        <Stack spacing={2}>
          {marketMoveBlock(scoresData)}
          {recommendedList(scoresData, buy, config)}
          <Stack alignSelf={`center`} direction={`row`}>
            {!!scoresData.recommended.length && (
              <Button
                onClick={() => {
                  if (confirm(`Are you sure you want to clear the scores?`)) {
                    google.script.run
                      .withSuccessHandler(() =>
                        setScoresData((prevState) => {
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
          </Stack>
        </Stack>
      )}
    </Box>
  )
}

function recommendedList(scoresData: ScoresData, buy: (coinName: string) => void, config: Config) {
  const theme = useTheme()

  const selectivity = config.ScoreSelectivity
  const selectivityMark = (
    <Typography variant={`caption`} color={theme.palette[selectivityColorMap[selectivity]].main}>
      {selectivity[0]}
    </Typography>
  )
  return (
    <>
      <Typography alignSelf={`center`} variant={`subtitle1`}>
        Recommended Coins ({selectivityMark})
      </Typography>
      {!scoresData.recommended.length && (
        <Typography alignSelf={`center`} variant={`body2`}>
          Nothing to show yet.
        </Typography>
      )}
      {!!scoresData.recommended.length && (
        <Stack>
          <List sx={{ padding: 0, marginTop: 0, width: cardWidth }}>
            {scoresData.recommended.map((rJson, i) => {
              const cs = CoinScore.fromObject(rJson)
              const order = i + 1
              return (
                <ListItem
                  sx={{ padding: `0 0 6px 40px` }}
                  key={cs.coinName}
                  disablePadding={true}
                  secondaryAction={
                    <Button size={`small`} onClick={() => buy(cs.coinName)}>
                      Buy
                    </Button>
                  }
                >
                  <ListItemAvatar sx={{ minWidth: `100px` }}>#{order}</ListItemAvatar>
                  <ListItemText
                    sx={{ margin: `3px 0 0 0` }}
                    primary={cs.coinName}
                    secondary={`Score: ${cs.getScore(selectivity)}`}
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

function marketMoveBlock(scores: ScoresData) {
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
