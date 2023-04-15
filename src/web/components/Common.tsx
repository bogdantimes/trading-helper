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
  <Alert severity="info">
    <Typography variant="body1">
      <div>Your installation is working in candidates view-only mode 👀.</div>
      <Link
        href="https://www.patreon.com/bePatron?u=52791105"
        target="_blank"
        rel="noopener noreferrer"
      >
        Become a Patron!
      </Link>
      {` `}to unlock "buy" signals and activate the fully-autonomous trading.
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
};
