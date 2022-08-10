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
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
} from "@mui/material"
import { circularProgress } from "./Common"
import { Config, f2, StableUSDCoin } from "../../lib"

export function Settings({
  config,
  setConfig,
}: {
  config: Config
  setConfig: (config: Config) => void
}) {
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const [profitLimit, setProfitLimit] = useState(f2(config.ProfitLimit * 100).toString())
  const [channelSize, setChannelSize] = useState(f2(config.ChannelSize * 100).toString())
  const [buyQuantity, setBuyQuantity] = useState(config.BuyQuantity.toString())
  const [investRatio, setInvestRatio] = useState(config.InvestRatio.toString())
  const [chDuration, setChDuration] = useState(config.ChannelWindowMins.toString())
  const [ttl, setTTL] = useState(config.TTL.toString())

  const [initialFbURL, setInitialFbURL] = useState(``)
  const [newFbURL, setNewFbURL] = useState(``)

  useEffect(() => setNewFbURL(initialFbURL), [initialFbURL])
  useEffect(() => {
    google.script.run
      .withSuccessHandler(setInitialFbURL)
      .withFailureHandler(setError)
      .getFirebaseURL()
  }, [])

  const onSave = () => {
    if (initialFbURL !== newFbURL) {
      google.script.run
        .withSuccessHandler(() => {
          setInitialFbURL(newFbURL)
        })
        .withFailureHandler(setError)
        .setFirebaseURL(newFbURL)
    }

    if (!config.StableCoin) {
      setError(`Stable Coin is required`)
      return
    }
    setError(null)

    isFinite(+profitLimit) && (config.ProfitLimit = +profitLimit / 100)
    isFinite(+channelSize) && (config.ChannelSize = +channelSize / 100)
    isFinite(+buyQuantity) && (config.BuyQuantity = Math.floor(+buyQuantity))
    isFinite(+investRatio) && (config.InvestRatio = Math.floor(+investRatio))
    isFinite(+chDuration) && (config.ChannelWindowMins = Math.floor(+chDuration))
    isFinite(+ttl) && +ttl >= 0 && (config.TTL = Math.floor(+ttl))
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
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
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
          value={investRatio}
          label={`Invest Ratio`}
          onChange={(e) => setInvestRatio(e.target.value)}
        />
        <TextField value={ttl} label={`TTL`} onChange={(e) => setTTL(e.target.value)} />
        <TextField
          value={buyQuantity}
          disabled={+investRatio > 0}
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
        </Stack>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2}>
            <TextField
              value={channelSize}
              label={`Price Channel Size`}
              onChange={(e) => setChannelSize(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">%</InputAdornment> }}
            />
            <TextField
              value={chDuration}
              label={`Channel Window (minutes)`}
              onChange={(e) => setChDuration(e.target.value)}
              InputProps={{
                startAdornment: <InputAdornment position="start">min.</InputAdornment>,
              }}
            />
          </Stack>
        </Stack>
        {switchers(config, setConfig)}
        <TextField
          value={newFbURL}
          label={`Firebase URL`}
          onChange={(e) => setNewFbURL(e.target.value)}
          sx={{ maxWidth: `389px` }}
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
            checked={config.SellAtStopLimit}
            onChange={(e) => setConfig({ ...config, SellAtStopLimit: e.target.checked })}
          />
        }
        label="Sell At Stop limit"
      />
    </Stack>
  )
}
