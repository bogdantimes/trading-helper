import * as React from 'react';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import {XYPlot, XAxis, YAxis, HorizontalGridLines, LineSeries} from 'react-vis';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {CardHeader} from "@mui/material";
import {TradeMemo} from "../../apps-script/TradeMemo";
import {Config} from "../../apps-script/Store";
import {useState} from "react";

export default function Trade(props) {
  const trade: TradeMemo = props.data;
  const config: Config = props.config;
  const takeProfitPrice = trade.tradeResult.price * (1 + config.TakeProfit);
  const [sellDisabled, setSellDisabled] = useState(false);

  function onSell() {
    if (prompt('Are you sure you want to sell?') === 'yes') {
      // @ts-ignore
      google.script.run.withSuccessHandler((resp) => {
        setSellDisabled(true);
        alert(resp.toString())
      }).quickSell(props.name);
    }
  }

  // @ts-ignore
  return (
    <Card sx={{bgcolor: "#0b1538", maxWidth: 345}}>
      <CardHeader title={props.name}/>
      <XYPlot xType="linear" width={300} height={200}>
        <HorizontalGridLines/>
        <XAxis hideTicks/>
        <YAxis title="Price"/>
        <LineSeries
          color='blue'
          data={trade.prices.map((y, x) => ({x, y}))}
        />
        <LineSeries
          color='red'
          data={new Array(trade.prices.length).fill(trade.stopLossPrice).map((y, x) => ({x, y}))}
        />
        <LineSeries
          color='green'
          data={new Array(trade.prices.length).fill(takeProfitPrice).map((y, x) => ({x, y}))}
        />
        <LineSeries
          color='gold'
          data={new Array(trade.prices.length).fill(trade.tradeResult.price).map((y, x) => ({x, y}))}
        />
      </XYPlot>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          <div>Total: 0.00 (0.00%)</div>
          <div>Profit: 0.00 (0.00%)</div>
          <div>Loss: 0.00 (0.00%)</div>
        </Typography>
      </CardContent>
      <CardActions>
        <Button size="small" disabled={sellDisabled} onClick={onSell}>Sell</Button>
        <Button size="small" disabled={true}>Buy More</Button>
      </CardActions>
    </Card>
  );
}
