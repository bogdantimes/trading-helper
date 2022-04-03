import * as React from 'react';
import {useState} from "react";
import {Config} from "../../apps-script/Store";
import {Button, Checkbox, FormControlLabel, FormGroup, TextField} from "@mui/material";

export default function Configuration(props) {
  const config: Config = props.config;
  const [buyQuantity, setBuyQuantity] = useState(config.BuyQuantity);
  const [takeProfit, setTakeProfit] = useState(config.TakeProfit);
  const [sellAtTakeProfit, setSellAtTakeProfit] = useState(config.SellAtTakeProfit);

  function onClickSave() {
    props.onSave({
      BuyQuantity: buyQuantity,
      LossLimit: takeProfit,
      SellAtTakeProfit: sellAtTakeProfit
    });
  }

  return (
    <FormGroup>
      <FormControlLabel control={
        <TextField type={"number"} value={buyQuantity}
                   onChange={(e) => setBuyQuantity(+e.target.value)}/>
      } label={"Buy Quantity"}/>
      <FormControlLabel control={
        <TextField type={"number"} value={takeProfit}
                   onChange={(e) => setTakeProfit(+e.target.value)}/>
      } label={"Take profit"}/>
      <FormControlLabel control={
        <Checkbox checked={sellAtTakeProfit}
                  onChange={(e) => setSellAtTakeProfit(e.target.checked)}/>
      } label="Sell at profit"/>
      <Button
        variant="contained"
        color="primary"
        onClick={onClickSave}>Save</Button>
    </FormGroup>
  );
}
