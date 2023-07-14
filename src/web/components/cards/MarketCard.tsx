import BasicCard from "./BasicCard";
import { Tooltip, Typography } from "@mui/material";
import Box from "@mui/material/Box";
import ImbalanceChecker from "../small/ImbalanceChecker";
import { f0 } from "../../../lib/index";
import * as React from "react";
import { MarketDemandInfo } from "../Common";

export default function MarketCard({
  demand,
}: {
  demand: {
    average: number;
    accuracy: number;
  };
}): JSX.Element {
  return (
    <BasicCard>
      <Typography
        variant="h6"
        fontWeight="bold"
        display="flex"
        alignItems="center"
      >
        Market
      </Typography>
      <Typography variant="body2" color="text.secondary">
        <Box display="flex" justifyContent="space-between" alignItems="center">
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
          <ImbalanceChecker initialValue={demand.average} />
        </Box>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="inherit" fontWeight="bold" mr={`5px`}>
            Accuracy:
          </Typography>
          <Typography variant="inherit">
            {f0(demand.accuracy * 100)}%
          </Typography>
        </Box>
      </Typography>
    </BasicCard>
  );
}
