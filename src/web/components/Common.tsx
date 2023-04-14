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

export const cardWidth = `270px`;

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
