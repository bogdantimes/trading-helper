import * as React from "react"
import { useEffect, useState } from "react"
import SaveIcon from "@mui/icons-material/Save"
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material"
import { capitalizeWord, circularProgress } from "./Common"
import { AutoTradeBestScores, Config, enumKeys, f2, StableUSDCoin } from "trading-helper-lib"
import { ScoreSelectivity } from "trading-helper-lib/dist/Types"

export function Settings() {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const [config, setConfig] = useState<Config>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  const [stopLimit, setLossLimit] = useState(``)
  const [profitLimit, setProfitLimit] = useState(``)
  const [buyQuantity, setBuyQuantity] = useState(``)

  useEffect(
    () =>
      google.script.run
        .withSuccessHandler((cfg) => {
          setLossLimit(f2(cfg.StopLimit * 100).toString())
          setProfitLimit(f2(cfg.ProfitLimit * 100).toString())
          setBuyQuantity(cfg.BuyQuantity.toString())
          setConfig(cfg)
          setConfigLoaded(true)
        })
        .getConfig(),
    [],
  )

  const onSave = () => {
    if (!config.StableCoin) {
      setError(`Stable Coin is required`)
      return
    }
    setError(null)

    isFinite(+stopLimit) && (config.StopLimit = +stopLimit / 100)
    isFinite(+profitLimit) && (config.ProfitLimit = +profitLimit / 100)
    isFinite(+buyQuantity) && (config.BuyQuantity = Math.floor(+buyQuantity))
    setConfig(config)
    setIsSaving(true)
    google.script.run
      .withFailureHandler((r) => {
        setIsSaving(false)
        setError(r)
      })
      .withSuccessHandler(() => {
        setIsSaving(false)
        setError(``)
      })
      .setConfig(config as any)
  }

  return (
    <Box
      sx={{ justifyContent: `center`, display: `flex` }}
    >
      {!configLoaded && circularProgress}
      {configLoaded && (
        <Stack spacing={2} divider={<Divider />}>
          <FormControl>
            <FormLabel>Stable Coin</FormLabel>
            <RadioGroup
              row
              value={config.StableCoin}
              onChange={(e, val) => setConfig({ ...config, StableCoin: val as StableUSDCoin })}
            >
              {Object.values(StableUSDCoin).map((coin) => (
                <FormControlLabel key={coin} value={coin} control={<Radio />} label={coin} />
              ))}
            </RadioGroup>
          </FormControl>
          <TextField
            value={buyQuantity}
            label={`Buy Quantity`}
            onChange={(e) => setBuyQuantity(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField
                value={profitLimit}
                label={`Profit Limit`}
                onChange={(e) => setProfitLimit(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">%</InputAdornment> }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={config.SellAtProfitLimit}
                    onChange={(e) => setConfig({ ...config, SellAtProfitLimit: e.target.checked })}
                  />
                }
                label="Auto-sell"
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                disabled={config.ProfitBasedStopLimit}
                value={stopLimit}
                label={`Stop Limit`}
                onChange={(e) => setLossLimit(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">%</InputAdornment> }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={config.SellAtStopLimit}
                    onChange={(e) => setConfig({ ...config, SellAtStopLimit: e.target.checked })}
                  />
                }
                label="Auto-sell"
              />
            </Stack>
          </Stack>
          <Stack spacing={1}>
            <TextField
              value={config.PriceAnomalyAlert}
              label={`Price Anomaly Alert`}
              onChange={(e) => setConfig({ ...config, PriceAnomalyAlert: +e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start">%</InputAdornment> }}
            />
            <Select
              value={[config.BuyDumps, config.SellPumps].toString()}
              onChange={(e) => {
                const [buyDumps, sellPumps] = e.target.value.split(`,`)
                setConfig({
                  ...config,
                  BuyDumps: buyDumps === `true`,
                  SellPumps: sellPumps === `true`,
                })
              }}
            >
              <MenuItem value={[false, false].toString()}>No Action</MenuItem>
              <MenuItem value={[true, false].toString()}>Buy Dumps</MenuItem>
              <MenuItem value={[false, true].toString()}>Sell Pumps</MenuItem>
              <MenuItem value={[true, true].toString()}>Buy Dumps & Sell Pumps</MenuItem>
            </Select>
          </Stack>
          {switchers(config, setConfig)}
          {autonomousTrading(config, setConfig)}
          {scoreThresholdSelector(config, setConfig)}
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
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      )}
    </Box>
  )
}

function switchers(
  config: Config,
  setConfig: (value: ((prevState: Config) => Config) | Config) => void,
) {
  return (
    <Stack>
      <FormControlLabel
        control={
          <Switch
            checked={config.ProfitBasedStopLimit}
            onChange={(e) => setConfig({ ...config, ProfitBasedStopLimit: e.target.checked })}
          />
        }
        label="P/L based Stop Limit"
      />
      <FormControlLabel
        control={
          <Switch
            checked={config.SwingTradeEnabled}
            onChange={(e) => setConfig({ ...config, SwingTradeEnabled: e.target.checked })}
          />
        }
        label="Swing trading"
      />
      <FormControlLabel
        control={
          <Switch
            checked={config.AveragingDown}
            onChange={(e) => setConfig({ ...config, AveragingDown: e.target.checked })}
          />
        }
        label="Averaging down"
      />
    </Stack>
  )
}

function scoreThresholdSelector(config: Config, setConfig: (config: Config) => void) {
  return (
    <FormControl>
      <FormLabel>Score Selectivity</FormLabel>
      <RadioGroup
        value={config.ScoreUpdateThreshold}
        onChange={(e) => setConfig({ ...config, ScoreUpdateThreshold: +e.target.value })}
      >
        {enumKeys(ScoreSelectivity).map((key) => (
          <FormControlLabel
            key={key}
            labelPlacement="end"
            value={ScoreSelectivity[key]}
            control={<Radio size={`small`} color={selectivityColorMap[ScoreSelectivity[key]]} />}
            label={
              <Box>
                <Typography marginBottom={`-8px`}>{capitalizeWord(key)}</Typography>
                <Typography variant={`caption`}>
                  {`Only ${f2(ScoreSelectivity[key] * 100)}% passes the threshold`}
                </Typography>
              </Box>
            }
          />
        ))}
      </RadioGroup>
    </FormControl>
  )
}

const selectivityColorMap = {
  [ScoreSelectivity.EXTREME]: `error`,
  [ScoreSelectivity.HIGH]: `warning`,
  [ScoreSelectivity.MODERATE]: `info`,
  [ScoreSelectivity.MINIMAL]: `success`,
}

function autonomousTrading(config: Config, setConfig: (config: Config) => void) {
  return (
    <FormControl sx={{ paddingRight: `28px` }}>
      <FormLabel>Autonomous Trading</FormLabel>
      <Slider
        sx={{ marginLeft: `10px` }}
        value={config.AutoTradeBestScores}
        onChange={(e, value) =>
          setConfig({ ...config, AutoTradeBestScores: value as AutoTradeBestScores })
        }
        step={null}
        min={0}
        max={10}
        marks={enumKeys(AutoTradeBestScores).map((key) => ({
          value: AutoTradeBestScores[key],
          label: capitalizeWord(key),
        }))}
      />
    </FormControl>
  )
}
