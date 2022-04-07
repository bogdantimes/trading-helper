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
  const tradeMemo: TradeMemo = props.data;
  const config: Config = props.config;
  const takeProfitPrice = tradeMemo.tradeResult.price * (1 + config.TakeProfit);
  const [sellDisabled, setSellDisabled] = useState(false);

  function onSell() {
    if (confirm('Are you sure you want to sell?')) {
      // @ts-ignore
      google.script.run.withSuccessHandler((resp) => {
        setSellDisabled(true);
        alert(resp.toString())
      }).sellCoin(props.name);
    }
  }

  const lossPercent = (100 * (tradeMemo.maxLoss / tradeMemo.tradeResult.paid)).toFixed(2)
  const profitPercent = (100 * (tradeMemo.maxProfit / tradeMemo.tradeResult.paid)).toFixed(2)

  // @ts-ignore
  return (
    <Card>
      <CardHeader title={props.name}/>
      <XYPlot xType="linear" width={300} height={200}>
        <HorizontalGridLines/>
        <XAxis hideTicks/>
        <YAxis title="Price"/>
        <LineSeries
          color='blue'
          data={tradeMemo.prices.map((y, x) => ({x, y}))}
        />
        <LineSeries
          color='red'
          data={new Array(tradeMemo.prices.length).fill(tradeMemo.stopLossPrice).map((y, x) => ({x, y}))}
        />
        <LineSeries
          color='green'
          data={new Array(tradeMemo.prices.length).fill(takeProfitPrice).map((y, x) => ({x, y}))}
        />
        <LineSeries
          color='gold'
          data={new Array(tradeMemo.prices.length).fill(tradeMemo.tradeResult.price).map((y, x) => ({x, y}))}
        />
      </XYPlot>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          <div>Total: {tradeMemo.tradeResult.paid.toFixed(2)}</div>
          <div>{tradeMemo.maxProfit > 0 ? "Profit" : "Loss"}: {tradeMemo.maxProfit.toFixed(2)} ({profitPercent}%)</div>
          <div>Stop: {tradeMemo.maxLoss.toFixed(2)} ({lossPercent}%)</div>
        </Typography>
      </CardContent>
      <CardActions>
        <Button size="small" disabled={sellDisabled} onClick={onSell}>Sell</Button>
        <Button size="small" disabled={true}>Buy More</Button>
      </CardActions>
    </Card>
  );
}
