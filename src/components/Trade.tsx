import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {TradeMemo} from "../../apps-script/TradeMemo";
import {Config} from "../../apps-script/Store";
import {createChart} from 'lightweight-charts';
import {FormControlLabel, Stack, Switch} from "@mui/material";

export default function Trade(props) {
  const tradeMemo: TradeMemo = props.data;
  const config: Config = props.config;
  const takeProfitPrice = tradeMemo.tradeResult.price * (1 + config.TakeProfit);

  const chartContainerRef = useRef();
  const chart = useRef(null);

  useEffect(() => {
    chart.current = createChart(chartContainerRef.current, {
      width: 300,
      height: 200,
      timeScale: {visible: false}
    });

    chart.current.timeScale().setVisibleLogicalRange({from: 0.5, to: 1.5});

    const mapFn = (v, i) => ({time: `2000-01-0${i + 1}`, value: v});

    chart.current
      .addLineSeries({color: "blue", lineWidth: 1})
      .setData(tradeMemo.prices.map(mapFn));

    chart.current
      .addLineSeries({color: "red", lineWidth: 1})
      .setData(new Array(tradeMemo.prices.length).fill(tradeMemo.stopLossPrice).map(mapFn));

    chart.current
      .addLineSeries({color: "green", lineWidth: 1})
      .setData(new Array(tradeMemo.prices.length).fill(takeProfitPrice).map(mapFn));

    chart.current
      .addLineSeries({color: "gold", lineWidth: 1})
      .setData(new Array(tradeMemo.prices.length).fill(tradeMemo.tradeResult.price).map(mapFn));

  }, []);


  const [isSelling, setIsSelling] = useState(false);

  function onSell() {
    if (confirm(`Are you sure you want to sell ${props.name}?`)) {
      setIsSelling(true);
      const handle = resp => {
        alert(resp.toString());
        setIsSelling(false);
      };
      // @ts-ignore
      google.script.run.withSuccessHandler(handle).withFailureHandler(handle).sellCoin(props.name);
    }
  }

  const [isBuying, setIsBuying] = useState(false);

  function onBuyMore() {
    if (confirm(`Are you sure you want to buy more ${props.name}?`)) {
      setIsBuying(true);
      const handle = resp => {
        alert(resp.toString());
        setIsBuying(false);
      };
      // @ts-ignore
      google.script.run.withSuccessHandler(handle).withFailureHandler(handle).buyCoin(props.name);
    }
  }

  const [isHodlSwitching, setIsHodlSwitching] = useState(false);
  const [isHodl, setIsHodl] = useState(tradeMemo.hodl);

  function flipHold() {
    setIsHodlSwitching(true);
    const handle = resp => {
      alert(resp.toString());
      setIsHodl(!isHodl);
      setIsHodlSwitching(false);
    };
    // @ts-ignore
    google.script.run.withSuccessHandler(handle).withFailureHandler(handle).setHold(props.name, !isHodl);
  }

  const lossPercent = (100 * (tradeMemo.maxLoss / tradeMemo.tradeResult.paid)).toFixed(2)
  const profitPercent = (100 * (tradeMemo.maxProfit / tradeMemo.tradeResult.paid)).toFixed(2)

  return (
    <Card>
      <CardContent>
        <Typography gutterBottom variant="h5" component="div">{props.name}</Typography>
        <div ref={chartContainerRef} className="chart-container"/>
        <Typography variant="body2" color="text.secondary">
          <div>Total: {tradeMemo.tradeResult.paid.toFixed(2)}</div>
          <div>{tradeMemo.maxProfit > 0 ? "Profit" : "Loss"}: {tradeMemo.maxProfit.toFixed(2)} ({profitPercent}%)</div>
          <div>Stop: {tradeMemo.maxLoss.toFixed(2)} ({lossPercent}%)</div>
        </Typography>
      </CardContent>
      <CardActions>
        <Stack direction={"row"} spacing={1}>
          <Button size="small" disabled={isSelling} onClick={onSell}>{isSelling ? 'Selling' : 'Sell'}</Button>
          <Button size="small" disabled={isBuying} onClick={onBuyMore}>{isBuying ? 'Buying...' : 'Buy More'}</Button>
          <FormControlLabel
            control={
              <Switch checked={isHodl} disabled={isHodlSwitching} onChange={flipHold}/>
            }
            label="HODL"
          />
        </Stack>
      </CardActions>
    </Card>
  );
}
