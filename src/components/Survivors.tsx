import * as React from "react";
import {useEffect} from "react";
import {CoinScore} from "../../apps-script/shared-lib/types";
import {Alert, Box, Button, IconButton, List, ListItem, ListItemAvatar, ListItemText, Stack} from "@mui/material";
import {Refresh} from "@mui/icons-material";
import {Config} from "../../apps-script/Store";
import {confirmBuy} from "./Common";

export function Survivors({config}: { config: Config }) {
  const [survivors, setSurvivors] = React.useState<CoinScore[]>([]);

  useEffect(() => {
    google.script.run.withSuccessHandler(setSurvivors).getSurvivors();
  }, [])

  function buy(coinName: string) {
    if (confirmBuy(coinName, config)) {
      google.script.run.withSuccessHandler(alert).buyCoin(coinName);
    }
  }

  return (
    <Box sx={{justifyContent: 'center', display: 'flex'}}>
      <Stack spacing={2}>
        <Alert sx={{width: 332}} severity={"info"}>
          Score represents how many times a currency showed a price growth within
          last {CoinScore.PRICES_MAX_CAP} measures, while 99% of the market was not moving up.
        </Alert>
        {!!survivors.length &&
          <List sx={{padding: 0, width: 332}}>
            {survivors.map((rJson, i) => {
              const r = CoinScore.fromObject(rJson);
              return (
                <ListItem disablePadding={true} secondaryAction={
                  <Button size={'small'} onClick={() => buy(r.getCoinName())}>Buy</Button>
                }>
                  <ListItemAvatar>#{i + 1}</ListItemAvatar>
                  <ListItemText sx={{marginBottom: 0}} primary={r.getCoinName()} secondary={`Score: ${r.getScore()}`}/>
                </ListItem>
              );
            })}
          </List>
        }
        <Stack alignSelf={"center"} spacing={2} direction={'row'}>
          {!!survivors.length &&
            <Button onClick={() => {
              if (confirm("Are you sure you want to clear the statistics?")) {
                google.script.run.withSuccessHandler(() => setSurvivors([])).resetSurvivors();
              }
            }}>Reset</Button>
          }
          <IconButton onClick={() => {
            google.script.run.withSuccessHandler(setSurvivors).getSurvivors();
          }}><Refresh/></IconButton>
        </Stack>
      </Stack>
    </Box>
  );
}
