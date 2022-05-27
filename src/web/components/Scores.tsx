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
} from "@mui/material"
import { Refresh } from "@mui/icons-material"
import { Config } from "../../gas/Store"
import { confirmBuy } from "./Common"
import { CoinScore } from "../../shared-lib/CoinScore"

export function Scores({ config }: { config: Config }) {
  const [scores, setScores] = React.useState<CoinScore[]>([])

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
      <Stack spacing={2}>
        <Alert sx={{ width: 332 }} severity={`info`}>
          {infoMsg}
        </Alert>
        {!!scores.length && (
          <List sx={{ padding: 0, width: 332 }}>
            {scores.map((rJson, i) => {
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
        <Stack alignSelf={`center`} spacing={2} direction={`row`}>
          {!!scores.length && (
            <Button
              onClick={() => {
                if (confirm(`Are you sure you want to clear the statistics?`)) {
                  google.script.run.withSuccessHandler(() => setScores([])).resetScores()
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
    </Box>
  )
}
