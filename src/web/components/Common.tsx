import { Alert, CircularProgress, Link, Typography } from "@mui/material";
import * as React from "react";
import { PriceMove } from "../../lib";
import {
  KeyboardArrowDown,
  KeyboardArrowUp,
  KeyboardDoubleArrowDown,
  KeyboardDoubleArrowUp,
} from "@mui/icons-material";
import PublicEndpoints = google.script.PublicEndpoints;
import RunnerFunctions = google.script.RunnerFunctions;

export const circularProgress = (
  <>
    <CircularProgress
      size={24}
      sx={{
        position: `absolute`,
        top: `50%`,
        left: `50%`,
        marginTop: `-12px`,
        marginLeft: `-12px`,
      }}
    />
  </>
);

const map = new Map<PriceMove, JSX.Element>();
map.set(PriceMove.STRONG_DOWN, <KeyboardDoubleArrowDown htmlColor={`red`} />);
map.set(PriceMove.DOWN, <KeyboardArrowDown htmlColor={`red`} />);
map.set(
  PriceMove.NEUTRAL,
  <KeyboardArrowUp
    htmlColor={`lightblue`}
    sx={{ transform: `rotate(90deg)` }}
  />
);
map.set(PriceMove.UP, <KeyboardArrowUp htmlColor={`green`} />);
map.set(PriceMove.STRONG_UP, <KeyboardDoubleArrowUp htmlColor={`green`} />);

export const growthIconMap = map;

export const capitalizeWord = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

export const cardMinWidth = `270px`;
export const cardMaxWidth = `415px`;

export const featureDisabledInfo = (
  <Alert
    severity="info"
    sx={{
      maxWidth: `675px`,
      minWidth: cardMinWidth,
      ml: `auto`,
      mr: `auto`,
    }}
  >
    <Typography variant="body1">
      <div>Your installation is working in candidates view-only mode 👀.</div>
      <Link
        href="https://www.patreon.com/bePatron?u=52791105"
        target="_blank"
        rel="noopener noreferrer"
      >
        Unlock Trading Helper+
      </Link>
      {` `}(free trial available) with the following features:
      <ul>
        <li>Continuous market demand scanning for more candidates</li>
        <li>"Buy" signals for fully-autonomous trading</li>
      </ul>
    </Typography>
    <Typography variant="caption">
      <b>Important: use the same Google account in Patreon.</b>
    </Typography>
  </Alert>
);

export const ScriptApp: (RunnerFunctions & PublicEndpoints) | null = process.env
  .WEBDEV
  ? null
  : google.script.run;

export const MarketDemandInfo = `Market demand shows the balance between buy and sell orders. A positive value means more buyers, while a negative value indicates more sellers. This affects the asset's price and reflects market sentiment.`;

export const percentileToColorMap = {
  // Gradient from red to green, with keys from 0.1 to 0.9 and step 0.1
  0.0: `#ff0000`,
  0.1: `#ff0000`,
  0.2: `#ff3300`,
  0.3: `#ff6600`,
  0.4: `#ff9900`,
  0.5: `#ffcc00`,
  0.6: `#ffff00`,
  0.7: `#ccff00`,
  0.8: `#99ff00`,
  0.9: `#66ff00`,
  1.0: `#00bb00`,
};
