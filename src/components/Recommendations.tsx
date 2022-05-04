import * as React from "react";
import {useEffect} from "react";
import {Recommendation} from "../../apps-script/lib/types";
import {Button} from "@mui/material";

export function Recommendations() {
  const [recommendations, setRecommendations] = React.useState<Recommendation[]>([]);

  useEffect(() => {
    // @ts-ignore
    google.script.run.withSuccessHandler(setRecommendations).getRecommendations();
  }, [])

  return (
    <div>
      {!!recommendations.length &&
        <>
          <ul>
            {recommendations.map((rJson) => {
              const coinName = Recommendation.getCoinName(rJson);
              return (
                <li key={coinName}>#{Recommendation.getRank(rJson)} {coinName}</li>
              );
            })}
          </ul>
          <Button onClick={() => {
            // @ts-ignore
            google.script.run.withSuccessHandler(() => {
              setRecommendations([]);
            }).resetRecommendations();
          }}>Reset</Button>
        </>
      }
    </div>
  );
}
