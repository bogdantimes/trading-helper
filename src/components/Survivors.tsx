import * as React from "react";
import {useEffect} from "react";
import {CoinScore} from "../../apps-script/shared-lib/types";
import {Box, Button, IconButton, Stack} from "@mui/material";
import {Refresh} from "@mui/icons-material";

export function Survivors() {
  const [survivors, setSurvivors] = React.useState<CoinScore[]>([]);

  useEffect(() => {
    // @ts-ignore
    google.script.run.withSuccessHandler(setSurvivors).getSurvivors();
  }, [])

  return (
    <Box sx={{justifyContent: 'center', display: 'flex'}}>
      <Stack spacing={2}>
        {!!survivors.length && <ul>
          {survivors.map((rJson, i) => {
            const r = CoinScore.fromObject(rJson);
            return (
              <li key={r.getCoinName()}>#{i + 1} {r.getCoinName()} (score={r.getScore()})</li>
            );
          })}
        </ul>}
        <Stack alignSelf={"center"} spacing={2} direction={'row'}>
          {!!survivors.length &&
            <Button variant="contained" color="primary" onClick={() => {
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
