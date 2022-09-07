import * as React from "react";
import { useEffect, useState } from "react";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  Divider,
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
import { Config, f2, StableUSDCoin } from "../../lib";

export function Settings({
  config,
  setConfig,
}: {
  config: Config;
  setConfig: (config: Config) => void;
}): JSX.Element {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [channelSize, setChannelSize] = useState(
    f2(config.ChannelSize * 100).toString()
  );
  const [balance, setBalance] = useState(config.StableBalance.toString());
  const [chDuration, setChDuration] = useState(
    config.ChannelWindowMins.toString()
  );

  const [initialFbURL, setInitialFbURL] = useState(``);
  const [newFbURL, setNewFbURL] = useState(``);

  useEffect(() => setNewFbURL(initialFbURL), [initialFbURL]);
  useEffect(() => {
    google.script.run
      .withSuccessHandler(setInitialFbURL)
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

    if (!config.StableCoin) {
      setError(`Stable Coin is required`);
      return;
    }
    setError(null);

    isFinite(+channelSize) && (config.ChannelSize = +channelSize / 100);
    isFinite(+balance) &&
      (+balance === -1 || +balance >= 0) &&
      (config.StableBalance = +balance);
    isFinite(+chDuration) &&
      (config.ChannelWindowMins = Math.floor(+chDuration));
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

  const [isSellingAll, setIsSellingAll] = useState(false);

  function onSellAll(): void {
    if (
      confirm(
        `Are you sure you want to sell all your assets? The operation cannot be undone.`
      )
    ) {
      setIsSellingAll(true);
      google.script.run
        .withSuccessHandler(() => {
          setIsSellingAll(false);
          alert(
            `All assets are being sold. Please wait for the operation to complete.`
          );
        })
        .withFailureHandler((r) => {
          setIsSellingAll(false);
          setError(r);
        })
        .sellAll();
    }
  }

  return (
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
      <Stack spacing={2} divider={<Divider />}>
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
        <Stack direction="row" spacing={2}>
          <TextField
            value={balance}
            label={`Balance`}
            onChange={(e) => setBalance(e.target.value)}
            fullWidth={true}
          />
          <FormControl fullWidth={true}>
            <InputLabel id={`mkt-trend`}>Trend ({config.AutoFGI})</InputLabel>
            <Select
              labelId="mkt-trend"
              value={config.FearGreedIndex}
              label={`Trend (${config.AutoFGI})`}
              defaultValue={2}
              onChange={(e) =>
                setConfig({ ...config, FearGreedIndex: +e.target.value })
              }
            >
              <MenuItem value={-1}>Auto Detect</MenuItem>
              <MenuItem value={1}>Bear Market</MenuItem>
              <MenuItem value={3}>Bull Market</MenuItem>
              <MenuItem value={2}>Oscillating</MenuItem>
            </Select>
          </FormControl>
        </Stack>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField
              fullWidth={true}
              value={channelSize}
              label={`Price Channel Size`}
              onChange={(e) => setChannelSize(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">%</InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth={true}
              value={chDuration}
              label={`Channel Window (minutes)`}
              onChange={(e) => setChDuration(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">min.</InputAdornment>
                ),
              }}
            />
          </Stack>
        </Stack>
        {switchers(config, setConfig)}
        <TextField
          value={newFbURL}
          label={`Firebase URL`}
          onChange={(e) => setNewFbURL(e.target.value)}
          sx={{ width: `49%` }}
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
        <Box alignSelf={`center`} sx={{ position: `relative` }}>
          <Button
            variant="contained"
            color="warning"
            onClick={onSellAll}
            disabled={isSellingAll}
          >
            !! Sell All !!
          </Button>
          {isSellingAll && circularProgress}
        </Box>
        {error && <Alert severity="error">{error.toString()}</Alert>}
      </Stack>
    </Box>
  );
}

function switchers(
  config: Config,
  setConfig: (value: ((prevState: Config) => Config) | Config) => void
): JSX.Element {
  return (
    <Stack>
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
    </Stack>
  );
}
