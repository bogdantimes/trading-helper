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
  Theme,
  Typography,
  useTheme,
} from "@mui/material"
import {
  capitalizeWord,
  cardWidth,
  circularProgress,
  confirmBuy,
  growthIconMap,
  selectivityColorMap,
} from "./Common"
import {
  AutoTradeBestScores,
  CoinScore,
  Config,
  f2,
  PriceMove,
  ScoresData,
} from "trading-helper-lib"

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

  const autoTrade = config.AutoTradeBestScores
  const selectivity = config.ScoreSelectivity
  const selectivityMark = (
    <Typography color={theme.palette[selectivityColorMap[selectivity]].main}>
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
          {getAlert(autoTrade)}
          <List sx={{ padding: 0, marginTop: 0, width: cardWidth }}>
            {scoresData.recommended.map((rJson, i) => {
              const cs = CoinScore.fromObject(rJson)
              const order = i + 1
              return (
                <ListItem
                  sx={{
                    padding: `0 0 6px 40px`,
                    borderBottomLeftRadius: autoTrade == order ? theme.shape.borderRadius : 0,
                    borderBottomRightRadius: autoTrade == order ? theme.shape.borderRadius : 0,
                    backgroundColor: autoTrade >= order && getAlertBackgroundColor(theme),
                  }}
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

function getAlertBackgroundColor(theme: Theme) {
  return theme.palette.mode == `dark` ? `#071318` : `#e5f6fd`
}

function getAlert(autoTrade: AutoTradeBestScores) {
  const theme = useTheme()
  return (
    <Alert
      severity={`info`}
      sx={{
        margin: 0,
        padding: `4px 16px`,
        borderBottomLeftRadius: autoTrade ? 0 : theme.shape.borderRadius,
        borderBottomRightRadius: autoTrade ? 0 : theme.shape.borderRadius,
        backgroundColor: getAlertBackgroundColor(theme),
        justifyContent: `center`,
        "& div": { padding: 0 },
      }}
    >
      <Typography marginTop={0} alignSelf={`center`} variant={`caption`}>
        Autonomous trading: {capitalizeWord(AutoTradeBestScores[autoTrade])}
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
      <Typography variant="caption">
        <b>Important: use the same Google account in Patreon.</b>
      </Typography>
    </Alert>
  )
}
