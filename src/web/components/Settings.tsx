import * as React from "react";
import { useState } from "react";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { circularProgress } from "./Common";
import { Config, f2, MarketTrend, StableUSDCoin } from "../../lib";

export function Settings(params: {
  config: Config;
  setConfig: (config: Config) => void;
  firebaseURL: string;
}): JSX.Element {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(
    f2(params.config.StableBalance).toString()
  );
  const [cfg, setCfg] = useState(params.config);

  const [initialFbURL, setInitialFbURL] = useState(params.firebaseURL);
  const [newFbURL, setNewFbURL] = useState(params.firebaseURL);

  const onSave = (): void => {
    if (initialFbURL !== newFbURL) {
      google.script.run
        .withSuccessHandler(() => {
          setInitialFbURL(newFbURL);
        })
        .withFailureHandler(setError)
        .setFirebaseURL(newFbURL);
    }

    setError(null);

    if (isFinite(+balance) && (+balance === -1 || +balance >= 0)) {
      cfg.StableBalance = +balance;
    } else {
      setError(
        `Balance must be a positive number or -1 to initialize with the current balance`
      );
      return;
    }

    setIsSaving(true);
    google.script.run
      .withFailureHandler((r) => {
        setIsSaving(false);
        setError(r);
      })
      .withSuccessHandler(() => {
        setIsSaving(false);
        setError(``);
        params.setConfig(cfg);
      })
      .setConfig(cfg as any);
  };

  const trend = `Market Trend (${marketTrendLabel[cfg.AutoMarketTrend]})`;
  return (
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
      <Stack spacing={2} sx={{ maxWidth: `400px` }}>
        <FormControl>
          <FormLabel>Stable Coin</FormLabel>
          <RadioGroup
            row
            value={cfg.StableCoin}
            onChange={(e, val) =>
              setCfg({ ...cfg, StableCoin: val as StableUSDCoin })
            }
          >
            {Object.values(StableUSDCoin).map((coin) => (
              <FormControlLabel
                key={coin}
                value={coin}
                control={<Radio />}
                label={coin}
              />
            ))}
          </RadioGroup>
        </FormControl>
        <Stack direction={`row`} spacing={2}>
          <TextField
            fullWidth
            value={balance}
            label={`Balance`}
            onChange={(e) => setBalance(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">$</InputAdornment>
              ),
            }}
          />
          <FormControl fullWidth>
            <InputLabel id={`trend`}>{trend}</InputLabel>
            <Select
              labelId="trend"
              value={cfg.MarketTrend}
              label={trend}
              defaultValue={MarketTrend.SIDEWAYS}
              onChange={(e) => setCfg({ ...cfg, MarketTrend: +e.target.value })}
            >
              <MenuItem value={-1}>Auto</MenuItem>
              <MenuItem value={MarketTrend.SIDEWAYS}>
                {marketTrendLabel[MarketTrend.SIDEWAYS]}
              </MenuItem>
              <MenuItem value={MarketTrend.UP}>
                {marketTrendLabel[MarketTrend.UP]}
              </MenuItem>
              <MenuItem value={MarketTrend.DOWN}>
                {marketTrendLabel[MarketTrend.DOWN]}
              </MenuItem>
            </Select>
          </FormControl>
        </Stack>
        <Stack direction={`row`} spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={cfg.SellAtStopLimit}
                onChange={(e) =>
                  setCfg({ ...cfg, SellAtStopLimit: e.target.checked })
                }
              />
            }
            label="Sell At Stop limit"
          />
          <FormControlLabel
            control={
              <Switch
                checked={cfg.ViewOnly}
                onChange={(e) => setCfg({ ...cfg, ViewOnly: e.target.checked })}
              />
            }
            label="View-only"
          />
        </Stack>
        <TextField
          type={`password`}
          value={cfg.KEY}
          label={`Binance API Key`}
          onChange={(e) => setCfg({ ...cfg, KEY: e.target.value })}
          name="binanceAPIKey"
        />
        <TextField
          type={`password`}
          value={cfg.SECRET}
          label={`Binance Secret Key`}
          onChange={(e) => setCfg({ ...cfg, SECRET: e.target.value })}
          name="binanceSecretKey"
        />
        <TextField
          value={newFbURL}
          label={`Firebase URL`}
          onChange={(e) => setNewFbURL(e.target.value)}
          helperText={`Firebase Realtime Database can be used as a persistent storage. Provide the URL to seamlessly switch to it. Remove the URL to switch back to the built-in Google Apps Script storage. Your data won't be lost.`}
        />
        <Box alignSelf={`center`} sx={{ position: `relative` }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={onSave}
            disabled={isSaving}
          >
            Save
          </Button>
          {isSaving && circularProgress}
        </Box>
        {error && <Alert severity="error">{error.toString()}</Alert>}
      </Stack>
    </Box>
  );
}

const marketTrendLabel = {
  [MarketTrend.UP]: `Up`,
  [MarketTrend.DOWN]: `Down`,
  [MarketTrend.SIDEWAYS]: `Sideways`,
};
