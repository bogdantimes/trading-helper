import * as React from 'react';
import {useEffect, useState} from 'react';
import SaveIcon from '@mui/icons-material/Save';
import {Config} from "../../apps-script/Store";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import {circularProgress} from "./Common";
import {PriceProvider} from "../../apps-script/TradeResult";
import {StableUSDCoin} from "../../apps-script/shared-lib/types";

export function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [config, setConfig] = useState<Config>({
    BuyQuantity: 0,
    StopLimit: 0,
    StableCoin: '' as StableUSDCoin,
    SellAtStopLimit: false,
    SellAtProfitLimit: false,
    ProfitLimit: 0,
    SwingTradeEnabled: false,
    PriceProvider: PriceProvider.Binance,
    AveragingDown: false,
    ProfitBasedStopLimit: false
  });
  const [configLoaded, setConfigLoaded] = useState(false);

  const [stopLimit, setLossLimit] = useState('');
  const [profitLimit, setProfitLimit] = useState('');
  const [buyQuantity, setBuyQuantity] = useState('');

  useEffect(() => google.script.run.withSuccessHandler(config => {
    setLossLimit((+(config.StopLimit * 100).toFixed(2)).toString());
    setProfitLimit((+(config.ProfitLimit * 100).toFixed(2)).toString());
    setBuyQuantity(config.BuyQuantity.toString());
    setConfig(config);
    setConfigLoaded(true);
  }).getConfig(), [])

  const onSave = () => {
    if (!config.StableCoin) {
      setError('Stable Coin is required');
      return
    }
    setError(null);

    isFinite(+stopLimit) && (config.StopLimit = +stopLimit / 100);
    isFinite(+profitLimit) && (config.ProfitLimit = +profitLimit / 100);
    isFinite(+buyQuantity) && (config.BuyQuantity = Math.floor(+buyQuantity));
    setConfig(config);
    setIsSaving(true);
    google.script.run
      .withFailureHandler(r => {
        setIsSaving(false);
        setError(r);
      })
      .withSuccessHandler(() => {
        setIsSaving(false);
        setError('');
      })
      .setConfig(config);
  }

  return (
    <Box sx={{justifyContent: 'center', display: 'flex', '& .MuiTextField-root': {width: '25ch'}}}>
      {!configLoaded && circularProgress}
      {configLoaded &&
        <Stack spacing={2}>
          <Autocomplete
            disableClearable={true}
            value={config.StableCoin}
            options={Object.values(StableUSDCoin)}
            onChange={(e, val) => val && setConfig({...config, StableCoin: val as StableUSDCoin})}
            renderInput={(params) => <TextField {...params} label={"Stable Coin"}/>}
          />
          <TextField value={buyQuantity} label={"Buy Quantity"} onChange={e => setBuyQuantity(e.target.value)}
                     InputProps={{startAdornment: <InputAdornment position="start">$</InputAdornment>}}
          />
          <Stack direction="row" spacing={2}>
            <TextField value={profitLimit} label={"Profit Limit"} onChange={e => setProfitLimit(e.target.value)}
                       InputProps={{startAdornment: <InputAdornment position="start">%</InputAdornment>}}
            />
            <FormControlLabel
              control={
                <Switch checked={config.SellAtProfitLimit}
                        onChange={e => setConfig({...config, SellAtProfitLimit: e.target.checked})}/>
              } label="Auto-sell"
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField disabled={config.ProfitBasedStopLimit} value={stopLimit} label={"Stop Limit"}
                       onChange={e => setLossLimit(e.target.value)}
                       InputProps={{startAdornment: <InputAdornment position="start">%</InputAdornment>}}
            />
            <FormControlLabel
              control={
                <Switch checked={config.SellAtStopLimit}
                        onChange={e => setConfig({...config, SellAtStopLimit: e.target.checked})}/>
              } label="Auto-sell"
            />
          </Stack>
          <FormControlLabel
            sx={{margin: 0}}
            control={
              <Switch checked={config.ProfitBasedStopLimit}
                      onChange={e => setConfig({...config, ProfitBasedStopLimit: e.target.checked})}/>
            } label="P/L based Stop Limit"
          />
          <FormControlLabel
            control={
              <Switch checked={config.SwingTradeEnabled}
                      onChange={e => setConfig({...config, SwingTradeEnabled: e.target.checked})}/>
            } label="Swing trading"
          />
          <FormControlLabel
            control={
              <Switch checked={config.AveragingDown}
                      onChange={e => setConfig({...config, AveragingDown: e.target.checked})}/>
            } label="Averaging down"
          />
          <Box alignSelf={"center"} sx={{position: 'relative'}}>
            <Button variant="contained" color="primary" startIcon={<SaveIcon/>}
                    onClick={onSave} disabled={isSaving}>Save</Button>
            {isSaving && circularProgress}
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      }
    </Box>
  );
}
