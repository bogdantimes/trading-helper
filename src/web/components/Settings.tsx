import * as React from "react";
import { useState } from "react";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { circularProgress } from "./Common";
import { Config, enumKeys, f2, MarketTrend, StableUSDCoin } from "../../lib";

export function Settings(params: {
  config: Config;
  setConfig: (config: Config) => void;
  firebaseURL: string;
}): JSX.Element {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(
    params.config.StableBalance === -1
      ? ``
      : f2(params.config.StableBalance).toString()
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

    const autoDetect = -1;
    if (isFinite(+balance) && (+balance === autoDetect || +balance >= 0)) {
      cfg.StableBalance = balance === `` ? autoDetect : +balance;
    } else if (balance !== ``) {
      setError(
        `Balance must be a positive number or empty to auto-detect it from Binance.`
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
      <Stack spacing={2} sx={{ maxWidth: `400px` }} divider={<Divider />}>
        <Stack direction={`row`} spacing={2}>
          <FormControl fullWidth>
            <InputLabel id={`stable-coin`}>Stable Coin</InputLabel>
            <Select
              labelId="stable-coin"
              value={cfg.StableCoin}
              label={`Stable Coin`}
              defaultValue={StableUSDCoin.BUSD}
              onChange={(e) =>
                setCfg({ ...cfg, StableCoin: e.target.value as StableUSDCoin })
              }
            >
              {enumKeys<StableUSDCoin>(StableUSDCoin).map((coin) => (
                <MenuItem key={coin} value={coin}>
                  {coin}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            value={balance}
            placeholder={`Auto-detect`}
            label={`Balance`}
            onChange={(e) => setBalance(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">$</InputAdornment>
              ),
            }}
          />
        </Stack>
        <FormControl fullWidth>
          <InputLabel id={`trend`}>{trend}</InputLabel>
          <Select
            labelId="trend"
            value={cfg.MarketTrend}
            label={trend}
            defaultValue={MarketTrend.SIDEWAYS}
            onChange={(e) => setCfg({ ...cfg, MarketTrend: +e.target.value })}
            aria-describedby={`trend-helper-text`}
          >
            <MenuItem value={-1}>Auto-detect</MenuItem>
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
          <FormHelperText id={`trend-helper-text`}>
            Market trend defines some characteristics of the trading algorithm.
            In general: quicker trades when the market is trending up.
            Auto-detect is updated every 3 days and uses the BTC price move over
            the last 3 weeks.
          </FormHelperText>
        </FormControl>
        <FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={cfg.SellAtStopLimit}
                onChange={(e) =>
                  setCfg({ ...cfg, SellAtStopLimit: e.target.checked })
                }
              />
            }
            label="Active stop-limits"
            aria-describedby={`stop-limit-helper-text`}
          />
          <FormHelperText id={`stop-limit-helper-text`}>
            Sell automatically when stop-limit is <b>crossed down</b>.
            Recommended to always keep enabled. Disable only if you need to hold
            the assets.
          </FormHelperText>
        </FormControl>
        <FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={cfg.HideBalances}
                onChange={(e) =>
                  setCfg({ ...cfg, HideBalances: e.target.checked })
                }
              />
            }
            label="Hide balances"
            aria-describedby={`hide-balances-helper-text`}
          />
          <FormHelperText id={`hide-balances-helper-text`}>
            Hides balances on the Home tab.
          </FormHelperText>
        </FormControl>
        <FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={cfg.ViewOnly}
                onChange={(e) => setCfg({ ...cfg, ViewOnly: e.target.checked })}
              />
            }
            label="View-only"
            aria-describedby={`view-only-helper-text`}
          />
          <FormHelperText id={`view-only-helper-text`}>
            Disables autonomous trading and makes Binance API keys optional.
          </FormHelperText>
        </FormControl>
        <Stack spacing={2}>
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
        </Stack>
        <TextField
          value={newFbURL}
          label={`Firebase URL`}
          onChange={(e) => setNewFbURL(e.target.value)}
          helperText={`Firebase Realtime Database can be used as a persistent storage. Provide the URL to seamlessly switch to it. Remove the URL to switch back to the built-in Google Apps Script storage. External database is essential only when you switch to a newer version of the tool.`}
        />
        <Stack spacing={2}>
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
          <Alert severity="info">
            The tool internal update interval is 1 minute, so it may take up to
            1 minute ⏳ for some changes to take effect.
          </Alert>
        </Stack>
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
