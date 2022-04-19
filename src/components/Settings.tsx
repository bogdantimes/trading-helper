import * as React from 'react';
import {useEffect} from "react";
import SaveIcon from '@mui/icons-material/Save';
import {Config} from "../../apps-script/Store";
import {Box, Button, FormControlLabel, InputAdornment, Stack, Switch, TextField} from "@mui/material";

export default function Settings() {
  const [config, setConfig] = React.useState<Config>({
    BuyQuantity: 0,
    LossLimit: 0,
    PriceAsset: "",
    SellAtStopLimit: false,
    SellAtTakeProfit: false,
    TakeProfit: 0
  });

  // @ts-ignore
  useEffect(() => google.script.run.withSuccessHandler(setConfig).getConfig(), [])

  const handleChange = (prop: keyof Config) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({...config, [prop]: event.target.value});
  };

  const handlePercentChange = (prop: keyof Config) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({...config, [prop]: (+event.target.value / 100)});
  };

  // @ts-ignore
  const save = () => google.script.run.setConfig(config);

  return (
    <Stack spacing={2}>
      <TextField value={config.PriceAsset} label={"Price Asset"}
                 onChange={handleChange('PriceAsset')}
      />
      <TextField value={config.BuyQuantity} label={"Buy Quantity"}
                 onChange={handleChange('BuyQuantity')}
                 InputProps={{startAdornment: <InputAdornment position="start">$</InputAdornment>}}
      />
      <Stack direction="row" spacing={2}>
        <TextField value={config.TakeProfit * 100} label={"Take profit"}
                   onChange={handlePercentChange('TakeProfit')}
                   InputProps={{startAdornment: <InputAdornment position="start">%</InputAdornment>}}
        />
        <FormControlLabel
          control={
            <Switch checked={config.SellAtTakeProfit} onChange={handleChange("SellAtTakeProfit")}/>
          }
          label="Sell at profit"
        />
      </Stack>
      <Stack direction="row" spacing={2}>
        <TextField value={config.LossLimit * 100} label={"Loss limit"}
                   onChange={handlePercentChange('LossLimit')}
                   InputProps={{startAdornment: <InputAdornment position="start">%</InputAdornment>}}
        />
        <FormControlLabel
          control={
            <Switch checked={config.SellAtStopLimit} onChange={handleChange("SellAtStopLimit")}/>
          }
          label="Sell at loss limit"
        />
      </Stack>
      <Box>
        <Button
          onClick={save}
          startIcon={<SaveIcon/>}
          variant="contained"
        >
          Save
        </Button>
      </Box>
    </Stack>
  );
}
