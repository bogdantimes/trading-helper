import * as React from "react";
import {useEffect} from "react";
import {CoinScore} from "../../apps-script/shared-lib/types";
import {Alert, Box, Button, IconButton, List, ListItem, ListItemAvatar, ListItemText, Stack} from "@mui/material";
import {Refresh} from "@mui/icons-material";

export function Survivors() {
  const [survivors, setSurvivors] = React.useState<CoinScore[]>([]);

  useEffect(() => {
    google.script.run.withSuccessHandler(setSurvivors).getSurvivors();
  }, [])

  function buy(coinName: string) {
    if (confirm(`Are you sure you want to buy ${coinName}?`)) {
      google.script.run.withSuccessHandler(alert).buyCoin(coinName);
    }
  }

  return (
    <Box sx={{justifyContent: 'center', display: 'flex'}}>
      <Stack spacing={2}>
        <Alert sx={{width: 300}} severity={"info"}>
          Score represents how many times a currency showed a price growth within last {CoinScore.PRICES_MAX_CAP}
          measures, while 99% of the market was not moving up.
        </Alert>
        {!!survivors.length &&
          <List sx={{padding: 0, width: 300}}>
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
              google.script.run.withSuccessHandler(() => setSurvivors([])).resetSurvivors();
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
