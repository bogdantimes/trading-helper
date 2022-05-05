import * as React from "react";
import {useEffect} from "react";
import {Recommendation} from "../../apps-script/lib/types";
import {Box, Button, Stack} from "@mui/material";

export function Recommends() {
  const [recommends, setRecommends] = React.useState<Recommendation[]>([]);

  useEffect(() => {
    // @ts-ignore
    google.script.run.withSuccessHandler(setRecommends).getRecommends();
  }, [])

  return (
    <Box sx={{justifyContent: 'center', display: 'flex'}}>
      {!!recommends.length &&
        <Stack spacing={2}>
          <ul>
            {recommends.map((rJson, i) => {
              const r = Recommendation.fromObject(rJson);
              return (
                <li key={r.getCoinName()}>#{i+1} {r.getCoinName()} (score={r.getScore()})</li>
              );
            })}
          </ul>
          <Button variant="contained" onClick={() => {
            // @ts-ignore
            google.script.run.withSuccessHandler(() => setRecommends([])).resetRecommends();
          }}>Reset</Button>
        </Stack>
      }
    </Box>
  );
}
