import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {TradeMemo, TradeState} from "../../apps-script/TradeMemo";
import {Config} from "../../apps-script/Store";
import {ChartOptions, createChart, DeepPartial, IChartApi, ISeriesApi, LineStyle} from 'lightweight-charts';
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
  const [soldPriceLine, setSoldPriceLine] = useState<ISeriesApi<"Line">>(null);

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
      setSoldPriceLine(chart.current.addLineSeries({color: "cyan", lineWidth: 1}))
    }

    chart.current.timeScale().setVisibleLogicalRange({from: 0.5, to: tradeMemo.prices.length - 1.5});

    return () => {
      chart.current.remove();
      chart.current = null;
    };

  }, [tradeMemo.prices.length]);

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
        visible: !!orderPrice && !tradeMemo.stateIs(TradeState.SOLD),
        color: profitLineColor,
        // make dashed if config SellAtTakeProfit is false or HODLing
        lineStyle: !config.SellAtTakeProfit || tradeMemo.hodl ? LineStyle.Dashed : LineStyle.Solid
      });
      profitLine.setData(map(tradeMemo.prices, () => orderPrice * (1 + config.TakeProfit)))
    }

    if (soldPriceLine) {
      soldPriceLine.applyOptions({visible: tradeMemo.stateIs(TradeState.SOLD)});
      soldPriceLine.setData(map(tradeMemo.prices, () => tradeMemo.tradeResult.price))
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

  function onBuy() {
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

  const [buyCanceled, setBuyCanceled] = useState(false);

  function onCancelBuy() {
    if (confirm(`Are you sure you want to cancel buying ${props.name}?`)) {
      const handle = resp => {
        alert(resp.toString());
        setBuyCanceled(true);
      };
      // @ts-ignore
      google.script.run.withSuccessHandler(handle).withFailureHandler(alert).cancelBuy(props.name);
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

  const curProfit = tradeMemo.profit();
  const stopLimitLoss = tradeMemo.stopLimitLoss();
  const curProfitPercent = (100 * (curProfit / tradeMemo.tradeResult.paid)).toFixed(2)
  const stopLimitLossPercent = (100 * (stopLimitLoss / tradeMemo.tradeResult.paid)).toFixed(2)

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
          </CardContent>
          <Typography marginLeft={"16px"} variant="body2" color="text.secondary">
            <div>Qty: {tradeMemo.tradeResult.quantity} Paid: {tradeMemo.tradeResult.paid.toFixed(2)}</div>
            <div>{curProfit > 0 ? "Profit" : "Loss"}: {curProfit.toFixed(2)} ({curProfitPercent}%)</div>
            <div>Stop: {stopLimitLoss.toFixed(2)} ({stopLimitLossPercent}%)</div>
          </Typography>
          <CardActions>
            <Stack direction={"row"} spacing={1}>
              {tradeMemo.stateIs(TradeState.BOUGHT) &&
                <Button size="small" disabled={isSelling} onClick={onSell}>{isSelling ? '...' : 'Sell'}</Button>
              }
              {[TradeState.BOUGHT, TradeState.SOLD].includes(tradeMemo.getState()) &&
                <Button size="small" disabled={isBuying} onClick={onBuy}>
                  {isBuying ? '...' : `Buy ${tradeMemo.stateIs(TradeState.BOUGHT) ? 'More' : 'Again'}`}</Button>
              }
              {tradeMemo.stateIs(TradeState.BOUGHT) &&
                <Box sx={{position: 'relative'}}>
                  <ToggleButton size="small" value="check" selected={isHodl} color="primary" onChange={flipHodl}
                                disabled={isHodlSwitching}>HODL</ToggleButton>
                  {isHodlSwitching && circularProgress}
                </Box>
              }
              {tradeMemo.stateIs(TradeState.SOLD) &&
                <Button size="small" disabled={isRemoving} onClick={onRemove}>{isRemoving ? '...' : 'Remove'}</Button>
              }
              {tradeMemo.stateIs(TradeState.BUY) &&
                <Button size="small" disabled={buyCanceled} onClick={onCancelBuy}>Cancel</Button>
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
