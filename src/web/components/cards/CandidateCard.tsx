import React from "react";
import BasicCard from "./BasicCard";
import Box from "@mui/material/Box";
import { Tooltip, Typography } from "@mui/material";
import SemiCircleProgressBar from "react-progressbar-semicircle";
import {
  growthIconMap,
  MarketDemandInfo,
  percentileToColorMap,
} from "../Common";
import { type CandidateInfo, f0, Key, PriceMove } from "../../../lib/index";
import ImbalanceChecker from "../small/ImbalanceChecker";

interface CandidateCardProps {
  coin: string;
  ci: CandidateInfo;
}

export default function CandidateCard({
  coin,
  ci,
}: CandidateCardProps): JSX.Element {
  const strength = ci[Key.STRENGTH] ?? 0;
  const priceMove = ci[Key.PRICE_MOVE] ?? PriceMove.NEUTRAL;
  const min = ci[Key.MIN];
  const max = ci[Key.MAX];

  return (
    <BasicCard>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box width="100%" mr={`16px`}>
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
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Tooltip title={MarketDemandInfo}>
                <Typography
                  variant="inherit"
                  sx={{
                    fontWeight: `bold`,
                    mr: `5px`,
                    textDecoration: `underline dashed`,
                  }}
                >
                  Demand:
                </Typography>
              </Tooltip>
              <ImbalanceChecker coinName={coin} initialValue={0} ci={ci} />
            </Box>
          </Typography>
        </Box>
        <Box textAlign="center">
          <SemiCircleProgressBar
            diameter={80}
            percentage={f0(strength * 100)}
            stroke={percentileToColorMap[+strength.toFixed(1)]}
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
