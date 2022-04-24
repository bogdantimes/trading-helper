import * as React from 'react';
import {useEffect, useState} from 'react';
import SaveIcon from '@mui/icons-material/Save';
import {Config} from "../../apps-script/Store";
import {Box, Button, FormControlLabel, InputAdornment, Snackbar, Stack, Switch, TextField,} from "@mui/material";
import {circularProgress} from "./Common";
import {PriceProvider} from "../../apps-script/TradeResult";

export function Settings() {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const [config, setConfig] = useState<Config>({
    BuyQuantity: 0,
    LossLimit: 0,
    PriceAsset: "",
    SellAtStopLimit: false,
    SellAtTakeProfit: false,
    TakeProfit: 0,
    SwingTradeEnabled: false,
    PriceProvider: PriceProvider.Binance,
  });

  // @ts-ignore
  useEffect(() => google.script.run.withSuccessHandler(setConfig).getConfig(), [])

  const handleChange = (prop: keyof Config) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({...config, [prop]: event.target.value});
  };

  const handleSwitchChange = (prop: keyof Config) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({...config, [prop]: event.target.checked});
  };

  const handlePercentChange = (prop: keyof Config) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({...config, [prop]: (+event.target.value / 100)});
  };

  const onSave = () => {
    setIsSaving(true);
    // @ts-ignore
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
    <Box sx={{display: 'flex', '& .MuiTextField-root': {width: '25ch'}}}>
      <Stack spacing={2}>
        <TextField value={config.PriceAsset} label={"Price Asset"}
                   onChange={handleChange('PriceAsset')}
        />
        <TextField value={config.BuyQuantity} label={"Buy Quantity"}
                   onChange={handleChange('BuyQuantity')}
                   InputProps={{startAdornment: <InputAdornment position="start">$</InputAdornment>}}
        />
        <Stack direction="row" spacing={2}>
          <TextField value={config.TakeProfit ? config.TakeProfit * 100 : ''} label={"Take profit"}
                     onChange={handlePercentChange('TakeProfit')}
                     InputProps={{startAdornment: <InputAdornment position="start">%</InputAdornment>}}
          />
          <FormControlLabel
            control={
              <Switch checked={config.SellAtTakeProfit} onChange={handleSwitchChange("SellAtTakeProfit")}/>
            }
            label="Auto-sell"
          />
        </Stack>
        <Stack direction="row" spacing={2}>
          <TextField value={config.LossLimit ? config.LossLimit * 100 : ''} label={"Loss limit"}
                     onChange={handlePercentChange('LossLimit')}
                     InputProps={{startAdornment: <InputAdornment position="start">%</InputAdornment>}}
          />
          <FormControlLabel
            control={
              <Switch checked={config.SellAtStopLimit} onChange={handleSwitchChange("SellAtStopLimit")}/>
            }
            label="Auto-sell"
          />
        </Stack>
        <FormControlLabel
          control={
            <Switch checked={config.SwingTradeEnabled} onChange={handleSwitchChange("SwingTradeEnabled")}/>
          }
          label="Swing trade"
        />
        <Stack direction={"row"}>
          <Box sx={{position: 'relative'}}>
            <Button variant="contained" color="primary" startIcon={<SaveIcon/>}
                    onClick={onSave} disabled={isSaving}>Save</Button>
            {isSaving && circularProgress}
          </Box>
        </Stack>
      </Stack>
      {error && <Snackbar open={!!error} message={error}/>}
    </Box>
  );
}
