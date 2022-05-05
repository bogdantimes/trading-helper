import * as React from "react";
import {useEffect} from "react";
import {Survivor} from "../../apps-script/lib/types";
import {Box, Button, Stack} from "@mui/material";

export function Survivors() {
  const [survivors, setSurvivors] = React.useState<Survivor[]>([]);

  useEffect(() => {
    // @ts-ignore
    google.script.run.withSuccessHandler(setSurvivors).getSurvivors();
  }, [])

  return (
    <Box sx={{justifyContent: 'center', display: 'flex'}}>
      {!!survivors.length &&
        <Stack spacing={2}>
          <ul>
            {survivors.map((rJson, i) => {
              const r = Survivor.fromObject(rJson);
              return (
                <li key={r.getCoinName()}>#{i+1} {r.getCoinName()} (score={r.getScore()})</li>
              );
            })}
          </ul>
          <Button variant="contained" onClick={() => {
            // @ts-ignore
            google.script.run.withSuccessHandler(() => setSurvivors([])).resetSurvivors();
          }}>Reset</Button>
        </Stack>
      }
    </Box>
  );
}
