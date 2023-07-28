import * as React from "react";
import { useState } from "react";
import SaveIcon from "@mui/icons-material/Save";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  Slider,
  Chip,
} from "@mui/material";
import { circularProgress, ScriptApp } from "./Common";
import {
  AUTO_DETECT,
  type Config,
  enumKeys,
  f2,
  StableUSDCoin,
} from "../../lib";
import BasicCard from "./cards/BasicCard";

export function Settings(params: {
  config: Config;
  setConfig: (config: Config) => void;
  firebaseURL: string;
}): JSX.Element {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(``);
  const [saveMsg, setSaveMsg] = useState(``);
  const [cfg, setCfg] = useState(params.config);

  const sBalance = (b): string => (b === AUTO_DETECT ? `` : `${f2(b)}`);
  const [balance, setBalance] = useState(sBalance(cfg.StableBalance));

  const [initialFbURL, setInitialFbURL] = useState(params.firebaseURL);
  const [newFbURL, setNewFbURL] = useState(params.firebaseURL);

  const onSave = (): void => {
    if (initialFbURL !== newFbURL) {
      ScriptApp?.withSuccessHandler(() => {
        setInitialFbURL(newFbURL);
      })
        .withFailureHandler((e) => {
          setError(e.message);
        })
        .setFirebaseURL(newFbURL);
    }

    setError(``);

    if (isFinite(+balance) && (+balance === AUTO_DETECT || +balance >= 0)) {
      cfg.StableBalance = balance === `` ? AUTO_DETECT : +balance;
    } else if (balance !== ``) {
      setError(
        `Balance must be a positive number or empty to auto-detect it from Binance.`
      );
      return;
    }

    setSaveMsg(``);
    setIsSaving(true);
    ScriptApp?.withFailureHandler((r) => {
      setIsSaving(false);
      setError(r.message);
    })
      .withSuccessHandler((result) => {
        setIsSaving(false);
        setError(``);
        setSaveMsg(result.msg);
        setBalance(sBalance(result.config.StableBalance));
        setCfg(result.config);
        params.setConfig(result.config);
      })
      .setConfig(cfg as any);
  };

  const tickIntervalMsg = `The tool internal update interval is 1 minute, so it may take up to 1 minute ⏳ for some changes to take effect.`;
  return (
    <BasicCard>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Avatar sx={{ bgcolor: `transparent` }}>⚙️</Avatar>
        <Typography variant="h6">Settings</Typography>
      </Stack>
      <Box sx={{ mt: 2, justifyContent: `center`, display: `flex` }}>
        <Stack spacing={2} divider={<Divider />}>
          <Stack direction={`row`} spacing={2}>
            <FormControl fullWidth>
              <InputLabel id={`stable-coin`}>Stable Coin</InputLabel>
              <Select
                labelId="stable-coin"
                value={cfg.StableCoin}
                label={`Stable Coin`}
                defaultValue={StableUSDCoin.BUSD}
                onChange={(e) => {
                  setCfg({
                    ...cfg,
                    StableCoin: e.target.value as StableUSDCoin,
                  });
                }}
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
              onChange={(e) => {
                setBalance(e.target.value);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">$</InputAdornment>
                ),
              }}
            />
          </Stack>
          <FormControl>
            <Typography id="budget-split-slider" gutterBottom>
              Minimum budget split
            </Typography>
            <Slider
              sx={{ ml: 1, width: `96%` }}
              defaultValue={1}
              value={cfg.BudgetSplitMin}
              step={1}
              marks={Array.from({ length: 10 }, (_, i) => ({
                value: i + 1,
                label: i + 1,
              }))}
              min={1}
              max={10}
              onChange={(e, newValue) => {
                setCfg({ ...cfg, BudgetSplitMin: newValue as number });
              }}
              aria-labelledby="budget-split-slider"
            />
            <FormHelperText>
              This setting limits the budget fraction per trade. A lower value
              (1) removes the limit and allows to use the entire budget for a
              single trade, while a higher value (10) allows to allocate only
              1/10th per trade, reducing the total profit/loss fluctuations.
              Recommended to increase the limit during unstable markets and
              reduce during widespread bullish markets.
            </FormHelperText>
          </FormControl>
          <FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={cfg.AutoReplenishFees}
                  onChange={(e) => {
                    setCfg({ ...cfg, AutoReplenishFees: e.target.checked });
                  }}
                />
              }
              label={`Replenish fees budget`}
              aria-describedby={`auto-replenish-fees-helper-text`}
            />
            <FormHelperText id={`auto-replenish-fees-helper-text`}>
              Automatically replenishes fees budget when it's low using
              available balance. Disable if you prefer to manage fees budget
              manually. For more information on BNB fees, visit:{` `}
              <Link
                target={`_blank`}
                rel="noreferrer"
                href={`https://binance.com/en/fee`}
              >
                https://binance.com/en/fee
              </Link>
            </FormHelperText>
          </FormControl>
          <FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={cfg.SmartExit}
                  onChange={(e) => {
                    setCfg({ ...cfg, SmartExit: e.target.checked });
                  }}
                />
              }
              label="Smart exit"
              aria-describedby={`smart-exit-helper-text`}
            />
            <FormHelperText id={`smart-exit-helper-text`}>
              Sell automatically when conditions are no longer in favor and it
              is better to take the profit/loss. Recommended to always keep
              enabled. Disable only if you need to hold the assets.
            </FormHelperText>
          </FormControl>
          <FormControl>
            <Typography id="range-slider" gutterBottom>
              <Chip
                label="New"
                color={`primary`}
                size="small"
                variant={`outlined`}
                style={{ marginRight: 10 }}
              />
              Market Demand Trading Range
            </Typography>
            <Slider
              sx={{ ml: 1, width: `96%` }}
              value={[cfg.MarketDemandTargets.min, cfg.MarketDemandTargets.max]}
              step={5}
              min={-10}
              max={110}
              disableSwap={true}
              marks={[
                { value: -10, label: `-10%` },
                { value: 10, label: `10%` },
                { value: 30, label: `30%` },
                { value: 50, label: `50%` },
                { value: 70, label: `70%` },
                { value: 90, label: `90%` },
                { value: 110, label: `110%` },
              ]}
              valueLabelDisplay="auto"
              onChange={(e, [min, max]: number[]) => {
                setCfg({
                  ...cfg,
                  MarketDemandTargets: { min, max },
                });
              }}
              aria-labelledby="range-slider"
            />
            <FormHelperText>
              This setting controls when to start and stop trading based on the
              current <b>position</b> of the market demand. Market demand
              fluctuates within its own range, and this setting controls the
              percentiles within that range, not the actual demand values. If
              you set the trading range to 20-60%, trading will start when
              demand climbs above the 60th percentile of the current range and
              will stop when demand drops below the 20th percentile of the
              current range. Once trading has stopped, it will not resume until
              market demand climbs back above the 60th percentile of its range.
            </FormHelperText>
          </FormControl>
          <FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={cfg.HideBalances}
                  onChange={(e) => {
                    setCfg({ ...cfg, HideBalances: e.target.checked });
                  }}
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
                  onChange={(e) => {
                    setCfg({ ...cfg, ViewOnly: e.target.checked });
                  }}
                />
              }
              label="View-only"
              aria-describedby={`view-only-helper-text`}
            />
            <FormHelperText id={`view-only-helper-text`}>
              Disables autonomous trading and makes Binance API keys optional.
              "Buy" signals, when unlocked, are sent via email.
            </FormHelperText>
          </FormControl>
          <Stack spacing={2}>
            <TextField
              type={`password`}
              value={cfg.KEY}
              label={`Binance API Key`}
              onChange={(e) => {
                setCfg({ ...cfg, KEY: e.target.value });
              }}
              name="binanceAPIKey"
            />
            <TextField
              type={`password`}
              value={cfg.SECRET}
              label={`Binance Secret Key`}
              onChange={(e) => {
                setCfg({ ...cfg, SECRET: e.target.value });
              }}
              name="binanceSecretKey"
            />
          </Stack>
          <TextField
            value={newFbURL}
            label={`Firebase URL`}
            onChange={(e) => {
              setNewFbURL(e.target.value);
            }}
            helperText={
              <>
                Firebase Realtime Database can be used as a persistent storage.
                Provide the URL to seamlessly switch to it. Remove the URL to
                switch back to the built-in Google Apps Script storage. For more
                information, visit:{` `}
                <Link
                  target={`_blank`}
                  rel="noreferrer"
                  href="https://www.google.com/search?q=how+to+create+firebase+realtime+database"
                >
                  How to create Firebase Realtime Database
                </Link>
              </>
            }
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
            {saveMsg && <Alert severity="info">{saveMsg}</Alert>}
            <Alert severity="info">{tickIntervalMsg}</Alert>
          </Stack>
          {error && <Alert severity="error">{error.toString()}</Alert>}
        </Stack>
      </Box>
    </BasicCard>
  );
}
