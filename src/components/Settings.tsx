import * as React from 'react';
import {useEffect, useState} from 'react';
import SaveIcon from '@mui/icons-material/Save';
import {Config} from "../../apps-script/Store";
import {Box, Button, FormControlLabel, InputAdornment, Snackbar, Stack, Switch, TextField,} from "@mui/material";
import {circularProgress} from "./Common";
import {PriceProvider} from "../../apps-script/TradeResult";

export function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const [config, setConfig] = useState<Config>({
    BuyQuantity: 0,
    StopLimit: 0,
    StableCoin: "",
    SellAtStopLimit: false,
    SellAtProfitLimit: false,
    ProfitLimit: 0,
    SwingTradeEnabled: false,
    PriceProvider: PriceProvider.Binance,
    AveragingDown: false,
  });

  const [stopLimit, setLossLimit] = useState('');
  const [profitLimit, setProfitLimit] = useState('');
  const [buyQuantity, setBuyQuantity] = useState('');

  useEffect(() => google.script.run.withSuccessHandler(config => {
    setLossLimit((+(config.StopLimit * 100).toFixed(2)).toString());
    setProfitLimit((+(config.ProfitLimit * 100).toFixed(2)).toString());
    setBuyQuantity(config.BuyQuantity.toString());
    setConfig(config);
  }).getConfig(), [])

  const onSave = () => {
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
      <Stack spacing={2}>
        <TextField value={config.StableCoin} label={"Stable Coin"}
                   onChange={e => setConfig({...config, StableCoin: e.target.value})}
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
            }
            label="Auto-sell"
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField value={stopLimit} label={"Stop Limit"} onChange={e => setLossLimit(e.target.value)}
                     InputProps={{startAdornment: <InputAdornment position="start">%</InputAdornment>}}
          />
          <FormControlLabel
            control={
              <Switch checked={config.SellAtStopLimit}
                      onChange={e => setConfig({...config, SellAtStopLimit: e.target.checked})}/>
            }
            label="Auto-sell"
          />
        </Stack>
        <FormControlLabel
          control={
            <Switch checked={config.SwingTradeEnabled}
                    onChange={e => setConfig({...config, SwingTradeEnabled: e.target.checked})}/>
          }
          label="Swing trading"
        />
        <FormControlLabel
          control={
            <Switch checked={config.AveragingDown}
                    onChange={e => setConfig({...config, AveragingDown: e.target.checked})}/>
          }
          label="Averaging down"
        />
        <Box alignSelf={"center"} sx={{position: 'relative'}}>
          <Button variant="contained" color="primary" startIcon={<SaveIcon/>}
                  onClick={onSave} disabled={isSaving}>Save</Button>
          {isSaving && circularProgress}
        </Box>
      </Stack>
      {error && <Snackbar open={!!error} message={error}/>}
    </Box>
  );
}
