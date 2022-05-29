import * as React from "react"
import { useEffect, useState } from "react"
import SaveIcon from "@mui/icons-material/Save"
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  Radio,
  RadioGroup,
  Slider,
  Stack,
  Switch,
  TextField,
} from "@mui/material"
import { capitalizeWord, circularProgress } from "./Common"
import { AutoTradeBestScores, StableUSDCoin } from "../../shared-lib/types"
import { enumKeys, f2 } from "../../shared-lib/functions"
import { Config } from "../../shared-lib/Config"

export function Settings() {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const [config, setConfig] = useState<Config>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  const [stopLimit, setLossLimit] = useState(``)
  const [profitLimit, setProfitLimit] = useState(``)
  const [buyQuantity, setBuyQuantity] = useState(``)
  const [hideAdvanced, setHideAdvanced] = useState(true)

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
      .setConfig(config)
  }

  return (
    <Box
      sx={{ justifyContent: `center`, display: `flex`, "& .MuiTextField-root": { width: `25ch` } }}
    >
      {!configLoaded && circularProgress}
      {configLoaded && (
        <Stack spacing={2}>
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
          <Divider />
          <TextField
            value={buyQuantity}
            label={`Buy Quantity`}
            onChange={(e) => setBuyQuantity(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
          <Divider />
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
          <Divider />
          <FormControlLabel
            sx={{ margin: 0 }}
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
          {advancedSettings(hideAdvanced, setHideAdvanced, config, setConfig)}
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

function advancedSettings(
  hide: boolean,
  setHide,
  config: Config,
  setConfig: (config: Config) => void,
) {
  return (
    <>
      <Divider sx={{ "::before, ::after": { top: 0 } }}>
        <Chip onClick={() => setHide(!hide)} label="Advanced" />
      </Divider>
      {!hide && (
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField
              value={config.PriceAnomalyAlert}
              label={`Price Anomaly Alert`}
              onChange={(e) => setConfig({ ...config, PriceAnomalyAlert: +e.target.value })}
              InputProps={{ startAdornment: <InputAdornment position="start">%</InputAdornment> }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={config.BuyDumps}
                  onChange={(e) => setConfig({ ...config, BuyDumps: e.target.checked })}
                />
              }
              label="Buy drops"
            />
          </Stack>
          <Divider />
          {autoTradeBestScoresSlider(config, setConfig)}
          {scoreThresholdSelector(config, setConfig)}
          <Divider />
        </Stack>
      )}
    </>
  )
}

function scoreThresholdSelector(config: Config, setConfig: (config: Config) => void) {
  return (
    <FormControl>
      <FormLabel>Score Selectivity</FormLabel>
      <RadioGroup
        row
        value={config.ScoreUpdateThreshold}
        onChange={(e) => setConfig({ ...config, ScoreUpdateThreshold: +e.target.value })}
      >
        <FormControlLabel
          labelPlacement="bottom"
          value={0.005}
          control={<Radio />}
          label="Extreme"
        />
        <FormControlLabel labelPlacement="bottom" value={0.01} control={<Radio />} label="High" />
        <FormControlLabel
          labelPlacement="bottom"
          value={0.05}
          control={<Radio />}
          label="Moderate"
        />
        <FormControlLabel labelPlacement="bottom" value={0.1} control={<Radio />} label="Minimal" />
      </RadioGroup>
    </FormControl>
  )
}

function autoTradeBestScoresSlider(config: Config, setConfig: (config: Config) => void) {
  return (
    <FormControl>
      <FormLabel>Auto Trade Best Scores</FormLabel>
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
