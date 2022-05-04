import * as React from "react";
import {useEffect} from "react";
import {Recommendation} from "../../apps-script/lib/types";
import {Button} from "@mui/material";

export function Recommends() {
  const [recommends, setRecommends] = React.useState<Recommendation[]>([]);

  useEffect(() => {
    // @ts-ignore
    google.script.run.withSuccessHandler(setRecommends).getRecommends();
  }, [])

  return (
    <div>
      {!!recommends.length &&
        <>
          <ul>
            {recommends.map((rJson, i) => {
              const coinName = Recommendation.getCoinName(rJson);
              return (
                <li key={coinName}>#{i+1} {coinName} (score={Recommendation.getScore(rJson)})</li>
              );
            })}
          </ul>
          <Button onClick={() => {
            // @ts-ignore
            google.script.run.withSuccessHandler(() => setRecommends([])).resetRecommends();
          }}>Reset</Button>
        </>
      }
    </div>
  );
}
