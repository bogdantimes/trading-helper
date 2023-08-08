import BasicCard from "./BasicCard";
import { Tooltip, Typography } from "@mui/material";
import Box from "@mui/material/Box";
import ImbalanceChecker from "../small/ImbalanceChecker";
import { f0, type MarketInfo } from "../../../lib/index";
import * as React from "react";
import { MarketDemandInfo, percentileToColorMap } from "../Common";
import SemiCircleProgressBar from "react-progressbar-semicircle";

export default function MarketCard({
  marketInfo,
}: {
  marketInfo: MarketInfo;
}): JSX.Element {
  const strength =
    marketInfo.strength === -1
      ? 0
      : Math.min(1, Math.max(0, marketInfo.strength / 100));

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
            Market
          </Typography>
          <Typography variant="body2" color="text.secondary">
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
              <ImbalanceChecker initialValue={marketInfo.averageDemand} />
            </Box>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <Tooltip
                title={`For TH+ subscribers, accuracy is automatically improved over-time with more and more candidates scanned in the background.`}
              >
                <Typography
                  variant="inherit"
                  sx={{
                    fontWeight: `bold`,
                    mr: `5px`,
                    textDecoration: `underline dashed`,
                  }}
                >
                  Accuracy:
                </Typography>
              </Tooltip>
              <Typography variant="inherit">
                {f0(marketInfo.accuracy * 100)}%
              </Typography>
            </Box>
          </Typography>
        </Box>
        <Box textAlign="center">
          <SemiCircleProgressBar
            diameter={80}
            percentage={marketInfo.strength}
            stroke={percentileToColorMap[strength.toFixed(1)]}
            strokeWidth={10}
          />
          <Typography mt={`-7px`} color="text.secondary" variant="body2">
            {marketInfo.strength === -1
              ? `Strength: N/A`
              : `Strength: ${marketInfo.strength}`}
          </Typography>
        </Box>
      </Box>
    </BasicCard>
  );
}
