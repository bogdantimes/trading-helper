import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {TradeMemo, TradeState} from "../../apps-script/TradeMemo";
import {Config} from "../../apps-script/Store";
import {
  ChartOptions,
  createChart,
  DeepPartial,
  IChartApi,
  ISeriesApi,
  LineStyle
} from 'lightweight-charts';
import {Box, Stack, Theme, ToggleButton, useTheme} from "@mui/material";
import {circularProgress} from "./Common";

export default function Trade(props) {
  const tradeMemo: TradeMemo = props.data;
  const config: Config = props.config;

  const chartContainerRef = useRef();
  const chart = useRef(null);
  const theme = useTheme();

  const [priceLine, setPriceLine] = useState<ISeriesApi<"Line">>(null);
  const [profitLine, setProfitLine] = useState<ISeriesApi<"Line">>(null);
  const [limitLine, setLimitLine] = useState<ISeriesApi<"Line">>(null);
  const [orderLine, setOrderLine] = useState<ISeriesApi<"Line">>(null);

  const map = (prices: number[], mapFn: (v: number) => number) => {
    return prices.map((v, i) => ({time: `${2000 + i}-01-01`, value: mapFn(v)}));
  };

  const chartOpts: DeepPartial<ChartOptions> = {
    width: 300,
    height: 200,
    timeScale: {visible: false},
    handleScroll: false,
    handleScale: false
  };

  // In dark more 'lightblue' color price line looks better
  const priceLineColor = theme.palette.mode === "light" ? "blue" : "lightblue";
  const profitLineColor = theme.palette.mode === "light" ? "green" : "lightgreen";

  useEffect(() => {

    if (!chart.current) {
      chart.current = createChart(chartContainerRef.current, chartOpts);

      setPriceLine(chart.current.addLineSeries({color: priceLineColor, lineWidth: 1}));
      setLimitLine(chart.current.addLineSeries({color: "red", lineWidth: 1}));
      setProfitLine(chart.current.addLineSeries({color: profitLineColor, lineWidth: 1}))
      setOrderLine(chart.current.addLineSeries({color: "gold", lineWidth: 1}))
    }

    chart.current.timeScale().setVisibleLogicalRange({from: 0.5, to: tradeMemo.prices.length - 1.5});

    return () => {
      chart.current.remove();
      chart.current = null;
    };

  }, [tradeMemo.prices.length, tradeMemo.getState()]);

  // refresh chart
  useEffect(() => {
    // change chart theme according to the current theme
    changeChartTheme(chart.current, theme);

    if (priceLine) {
      priceLine.setData(map(tradeMemo.prices, v => v));
      priceLine.applyOptions({color: priceLineColor});
    }

    if (limitLine) {
      limitLine.applyOptions({
        visible: !!tradeMemo.stopLossPrice,
        // make dashed if config SellAtStopLimit is false or HODLing
        lineStyle: !config.SellAtStopLimit || tradeMemo.hodl ? LineStyle.Dashed : LineStyle.Solid
      });
      limitLine.setData(map(tradeMemo.prices, () => tradeMemo.stopLossPrice))
    }

    const orderPrice = tradeMemo.tradeResult.price;

    if (orderLine) {
      orderLine.applyOptions({visible: !!orderPrice});
      orderLine.setData(map(tradeMemo.prices, () => orderPrice))
    }

    if (profitLine) {
      profitLine.applyOptions({
        visible: !!orderPrice,
        color: profitLineColor,
        // make dashed if config SellAtTakeProfit is false or HODLing
        lineStyle: !config.SellAtTakeProfit || tradeMemo.hodl ? LineStyle.Dashed : LineStyle.Solid
      });
      profitLine.setData(map(tradeMemo.prices, () => orderPrice * (1 + config.TakeProfit)))
    }

  }, [theme, tradeMemo, config, priceLine, profitLine, limitLine, orderLine]);

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

  function flipHodl() {
    setIsHodlSwitching(true);
    // @ts-ignore
    google.script.run.withSuccessHandler(() => {
      setIsHodl(!isHodl);
      setIsHodlSwitching(false);
    }).withFailureHandler(resp => {
      alert(resp.toString());
      setIsHodlSwitching(false);
    }).setHold(props.name, !isHodl);
  }

  const lossPercent = (100 * (tradeMemo.maxLoss / tradeMemo.tradeResult.paid)).toFixed(2)
  const profitPercent = (100 * (tradeMemo.maxProfit / tradeMemo.tradeResult.paid)).toFixed(2)

  const [isRemoving, setIsRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);

  function onRemove() {
    if (confirm(`Are you sure you want to remove ${props.name}?`)) {
      setIsRemoving(true);
      // @ts-ignore
      google.script.run
        .withSuccessHandler(() => {
          setIsRemoving(false);
          setRemoved(true);
        })
        .withFailureHandler(resp => {
          alert(resp.toString());
          setIsRemoving(false);
        })
        .dropCoin(props.name);
    }
  }

  return (
    <>
      {!removed &&
        <Card>
          <CardContent>
            <Typography gutterBottom variant="h5" component="div">{props.name}</Typography>
            <Box width={chartOpts.width} height={chartOpts.height} ref={chartContainerRef} className="chart-container"/>
            <Typography variant="body2" color="text.secondary">
              <div>Total: {tradeMemo.tradeResult.paid.toFixed(2)}</div>
              <div>{tradeMemo.maxProfit > 0 ? "Profit" : "Loss"}: {tradeMemo.maxProfit.toFixed(2)} ({profitPercent}%)</div>
              <div>Stop: {tradeMemo.maxLoss.toFixed(2)} ({lossPercent}%)</div>
            </Typography>
          </CardContent>
          <CardActions>
            <Stack direction={"row"} spacing={1}>
              {tradeMemo.stateIs(TradeState.BOUGHT) &&
                <>
                  <Button size="small" disabled={isSelling} onClick={onSell}>{isSelling ? '...' : 'Sell'}</Button>
                  <Button size="small" disabled={isBuying} onClick={onBuyMore}>{isBuying ? '...' : 'Buy More'}</Button>
                  <Box sx={{position: 'relative'}}>
                    <ToggleButton size="small" value="check" selected={isHodl} color="primary" onChange={flipHodl}
                                  disabled={isHodlSwitching}>HODL</ToggleButton>
                    {isHodlSwitching && circularProgress}
                  </Box>
                </>
              }

              {tradeMemo.stateIs(TradeState.SOLD) || tradeMemo.stateIs(TradeState.BUY) ?
                <Button size="small" disabled={isRemoving} onClick={onRemove}>{isRemoving ? '...' : 'Remove'}</Button>
                : <></>
              }
            </Stack>
          </CardActions>
        </Card>
      }
    </>
  );
}

function changeChartTheme(chart: IChartApi, theme: Theme) {
  chart && chart.applyOptions({
    layout: {
      backgroundColor: theme.palette.background.default,
      textColor: theme.palette.text.primary,
    },
    grid: {
      vertLines: {color: theme.palette.divider},
      horzLines: {color: theme.palette.divider},
    },
  });
}
