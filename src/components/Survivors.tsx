import * as React from "react";
import {useEffect} from "react";
import {CoinScore} from "../../apps-script/shared-lib/types";
import {Box, Button, IconButton, List, ListItem, ListItemAvatar, ListItemText, Stack} from "@mui/material";
import {Refresh} from "@mui/icons-material";
import {gsr} from "../App";

export function Survivors() {
  const [survivors, setSurvivors] = React.useState<CoinScore[]>([]);

  useEffect(() => {
    // @ts-ignore
    google.script.run.withSuccessHandler(setSurvivors).getSurvivors();
  }, [])

  function buy(coinName: string) {
    if (confirm(`Are you sure you want to buy ${coinName}?`)) {
      gsr.withSuccessHandler(alert).buyCoin(coinName);
    }
  }

  return (
    <Box sx={{justifyContent: 'center', display: 'flex'}}>
      <Stack spacing={2}>
        {!!survivors.length &&
          <List sx={{ width: 300 }}>
            {survivors.map((rJson, i) => {
              const r = CoinScore.fromObject(rJson);
              return (
                <ListItem disablePadding={true} secondaryAction={
                  <Button size={'small'} onClick={() => buy(r.getCoinName())}>Buy</Button>
                }>
                  <ListItemAvatar>#{i + 1}</ListItemAvatar>
                  <ListItemText primary={r.getCoinName()} secondary={`Score: ${r.getScore()}`}/>
                </ListItem>
              );
            })}
          </List>
        }
        <Stack alignSelf={"center"} spacing={2} direction={'row'}>
          {!!survivors.length &&
            <Button onClick={() => {
              // @ts-ignore
              google.script.run.withSuccessHandler(setSurvivors).resetSurvivors();
            }}>Reset</Button>
          }
          <IconButton onClick={() => {
            // @ts-ignore
            google.script.run.withSuccessHandler(setSurvivors).getSurvivors();
          }}><Refresh/></IconButton>
        </Stack>
      </Stack>
    </Box>
  );
}
