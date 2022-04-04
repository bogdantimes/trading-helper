import * as React from 'react';
import {useState} from "react";
import {Config} from "../../apps-script/Store";
import {Button, Checkbox, FormControlLabel, FormGroup, TextField} from "@mui/material";

export default function Settings(props) {
  const config: Config = props.config;
  const [buyQuantity, setBuyQuantity] = useState(config.BuyQuantity);
  const [takeProfit, setTakeProfit] = useState(config.TakeProfit);
  const [sellAtTakeProfit, setSellAtTakeProfit] = useState(config.SellAtTakeProfit);

  function onClickSave() {
    props.onSave({
      BuyQuantity: buyQuantity,
      TakeProfit: takeProfit,
      SellAtTakeProfit: sellAtTakeProfit
    });
  }

  return (
    <FormGroup>
      <TextField type={"number"} value={buyQuantity} label={"Buy Quantity"}
                 onChange={(e) => setBuyQuantity(+e.target.value)}/>
      <TextField type={"number"} value={takeProfit} label={"Take profit"}
                 onChange={(e) => setTakeProfit(+e.target.value)}/>
      <FormControlLabel control={
        <Checkbox checked={sellAtTakeProfit}
                  onChange={(e) => setSellAtTakeProfit(e.target.checked)}/>
      } label="Sell at profit"/>
      <Button onClick={onClickSave}>Save</Button>
    </FormGroup>
  );
}
