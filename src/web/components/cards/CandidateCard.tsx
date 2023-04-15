import React from "react";
import BasicCard from "./BasicCard";
import Box from "@mui/material/Box";
import { Typography } from "@mui/material";
import SemiCircleProgressBar from "react-progressbar-semicircle";
import { growthIconMap, percentileToColorMap } from "../Common";
import { type CandidateInfo, f0, Key, PriceMove } from "../../../lib/index";

interface CandidateCardProps {
  coin: string;
  candidateInfo: CandidateInfo;
}

export default function CandidateCard({
  coin,
  candidateInfo,
}: CandidateCardProps): JSX.Element {
  const strength = candidateInfo[Key.STRENGTH] ?? 0;
  const priceMove = candidateInfo[Key.PRICE_MOVE] ?? PriceMove.NEUTRAL;
  const min = candidateInfo[Key.MIN];
  const max = candidateInfo[Key.MAX];

  return (
    <BasicCard>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography
            variant="h6"
            fontWeight="bold"
            display="flex"
            alignItems="center"
          >
            {coin}
            {growthIconMap.get(priceMove)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="inherit" fontWeight="bold" mr={`5px`}>
                Support:
              </Typography>
              <Typography variant="inherit">{min}</Typography>
            </Box>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="inherit" fontWeight="bold" mr={`5px`}>
                Resistance:
              </Typography>
              <Typography variant="inherit">{max}</Typography>
            </Box>
          </Typography>
        </Box>
        <Box textAlign="center">
          <SemiCircleProgressBar
            diameter={80}
            percentage={f0(strength * 100)}
            stroke={percentileToColorMap[strength.toFixed(1)]}
            strokeWidth={10}
          />
          <Typography mt={`-7px`} color="text.secondary" variant="body2">
            Strength: {f0(strength * 100)}
          </Typography>
        </Box>
      </Box>
    </BasicCard>
  );
}
