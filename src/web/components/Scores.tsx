import * as React from "react"
import { useEffect } from "react"
import {
  Alert,
  Box,
  Button,
  Link,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material"
import { capitalizeWord, circularProgress, confirmBuy, growthIconMap } from "./Common"
import { CoinScore } from "../../shared-lib/CoinScore"
import { f2 } from "../../shared-lib/functions"
import { AutoTradeBestScores, PriceMove, ScoresData } from "../../shared-lib/types"
import { Config } from "../../shared-lib/Config"

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
      {scoresData && !scoresData.realData && featureDisabledInfo()}
      {scoresData && scoresData.realData && (
        <Stack spacing={2}>
          {marketMoveBlock(scoresData)}
          {recommendedList(scoresData, buy, config.AutoTradeBestScores)}
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

function recommendedList(
  scoresData: ScoresData,
  buy: (coinName: string) => void,
  autoTrade: AutoTradeBestScores,
) {
  return (
    <>
      <Stack>
        <Typography alignSelf={`center`} variant={`subtitle1`}>
          Recommended
        </Typography>
        {getAlert(autoTrade)}
      </Stack>
      {!scoresData.recommended.length && (
        <Typography alignSelf={`center`} variant={`body2`}>
          Nothing to show yet.
        </Typography>
      )}
      {!!scoresData.recommended.length && (
        <List sx={{ padding: 0, width: 332 }}>
          {scoresData.recommended.map((rJson, i) => {
            const cs = CoinScore.fromObject(rJson)
            return (
              <ListItem
                sx={{ paddingLeft: `40px` }}
                key={cs.coinName}
                disablePadding={true}
                secondaryAction={
                  <Button size={`small`} onClick={() => buy(cs.coinName)}>
                    Buy
                  </Button>
                }
              >
                <ListItemAvatar sx={{ minWidth: `100px` }}>#{i + 1}</ListItemAvatar>
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

function getAlert(autoTrade: AutoTradeBestScores) {
  return (
    <Alert
      severity={`info`}
      sx={{
        margin: 0,
        padding: 0,
        justifyContent: `center`,
        "& div": {
          padding: `1px 0`,
        },
      }}
    >
      <Typography marginTop={0} alignSelf={`center`} variant={`caption`}>
        Auto-buying {capitalizeWord(AutoTradeBestScores[autoTrade])}
      </Typography>
    </Alert>
  )
}

function featureDisabledInfo() {
  return (
    <Alert severity="info">
      <Typography variant="body1">
        <Link
          href="https://www.patreon.com/bePatron?u=52791105"
          target="_blank"
          rel="noopener noreferrer"
        >
          Become a Patron!
        </Link>
        {` `}to unlock the {`"Scores"`} functionality.
      </Typography>
    </Alert>
  )
}
