import * as React from "react";
import { useEffect, useState } from "react";
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
import { Config, f2, MarketCycle, StableUSDCoin } from "../../lib";

export function Settings({
  config,
  setConfig,
}: {
  config: Config;
  setConfig: (config: Config) => void;
}): JSX.Element {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(f2(config.StableBalance).toString());

  const [initialFbURL, setInitialFbURL] = useState(``);
  const [newFbURL, setNewFbURL] = useState(``);
  const [fbURLDisabled, setFbURLDisabled] = useState(true);

  useEffect(() => {
    google.script.run
      .withSuccessHandler((url: string) => {
        setInitialFbURL(url);
        setNewFbURL(url);
        setFbURLDisabled(false);
      })
      .withFailureHandler(setError)
      .getFirebaseURL();
  }, []);

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
      config.StableBalance = +balance;
    } else {
      setError(
        `Balance must be a positive number or -1 to initialize with the current balance`
      );
      return;
    }

    setConfig(config);
    setIsSaving(true);
    google.script.run
      .withFailureHandler((r) => {
        setIsSaving(false);
        setError(r);
      })
      .withSuccessHandler(() => {
        setIsSaving(false);
        setError(``);
      })
      .setConfig(config as any);
  };

  const cycle = `Market Cycle (${marketCycleLabel[config.AutoMarketCycle]})`;
  return (
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
      <Stack spacing={2} sx={{ maxWidth: `400px` }}>
        <FormControl>
          <FormLabel>Stable Coin</FormLabel>
          <RadioGroup
            row
            value={config.StableCoin}
            onChange={(e, val) =>
              setConfig({ ...config, StableCoin: val as StableUSDCoin })
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
        <TextField
          value={balance}
          label={`Balance`}
          onChange={(e) => setBalance(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          }}
        />
        <FormControl>
          <InputLabel id={`cycle`}>{cycle}</InputLabel>
          <Select
            labelId="cycle"
            value={config.MarketCycle}
            label={cycle}
            defaultValue={MarketCycle.SIDEWAYS}
            onChange={(e) =>
              setConfig({ ...config, MarketCycle: +e.target.value })
            }
          >
            <MenuItem value={-1}>Auto</MenuItem>
            <MenuItem value={MarketCycle.SIDEWAYS}>
              {marketCycleLabel[MarketCycle.SIDEWAYS]}
            </MenuItem>
            <MenuItem value={MarketCycle.MARK_UP}>
              {marketCycleLabel[MarketCycle.MARK_UP]}
            </MenuItem>
            <MenuItem value={MarketCycle.MARK_DOWN}>
              {marketCycleLabel[MarketCycle.MARK_DOWN]}
            </MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel
          control={
            <Switch
              checked={config.SellAtStopLimit}
              onChange={(e) =>
                setConfig({ ...config, SellAtStopLimit: e.target.checked })
              }
            />
          }
          label="Sell At Stop limit"
        />
        <TextField
          value={newFbURL}
          label={`Firebase URL`}
          onChange={(e) => setNewFbURL(e.target.value)}
          disabled={fbURLDisabled}
          helperText={`Firebase Realtime Database can be used as a persistent storage. Provide the URL to seamlessly switch to it. Remove the URL to switch back to the built-in Google Apps Script storage. Your data won't be lost.`}
        />
        <Box alignSelf={`center`} sx={{ position: `relative` }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={onSave}
            disabled={isSaving || fbURLDisabled}
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

const marketCycleLabel = {
  [MarketCycle.MARK_UP]: `Mark-up`,
  [MarketCycle.MARK_DOWN]: `Mark-down`,
  [MarketCycle.SIDEWAYS]: `Sideways`,
};
