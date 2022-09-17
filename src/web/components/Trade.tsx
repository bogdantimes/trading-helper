import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import {
  ChartOptions,
  createChart,
  DeepPartial,
  IChartApi,
  ISeriesApi,
  LineData,
  LineStyle,
  PriceScaleMode,
} from "lightweight-charts";
import { Box, Theme, useTheme } from "@mui/material";
import { TradeTitle } from "./TradeTitle";
import { Config, f2, getPrecision, TradeMemo, TradeState } from "../../lib";

export default function Trade(props: {
  data: TradeMemo;
  config: Config;
}): JSX.Element {
  const { data: tm, config: cfg } = props;
  const coinName = tm.getCoinName();

  const chartContainerRef = useRef();
  const chart = useRef<IChartApi>(null);
  const theme = useTheme();

  const [priceLine, setPriceLine] = useState<ISeriesApi<`Line`>>(null);
  const [profitLine, setProfitLine] = useState<ISeriesApi<`Line`>>(null);
  const [stopLine, setStopLine] = useState<ISeriesApi<`Line`>>(null);
  const [orderLine, setOrderLine] = useState<ISeriesApi<`Line`>>(null);
  const [soldPriceLine, setSoldPriceLine] = useState<ISeriesApi<`Line`>>(null);

  const map = (prices: number[], mapFn: (v: number) => number): LineData[] => {
    return prices.map((v, i) => ({
      time: `${2000 + i}-01-01`,
      value: mapFn(v),
    }));
  };

  const chartOpts: DeepPartial<ChartOptions> = {
    width: 300,
    height: 200,
    timeScale: { visible: false },
    handleScroll: false,
    handleScale: false,
    rightPriceScale: {
      mode: PriceScaleMode.Logarithmic,
    },
  };

  // In dark more 'lightblue' color price line looks better
  const priceLineColor = theme.palette.mode === `light` ? `blue` : `lightblue`;
  const profitLineColor =
    theme.palette.mode === `light` ? `green` : `lightgreen`;

  useEffect(() => {
    if (!chart.current) {
      chart.current = createChart(chartContainerRef.current, chartOpts);

      setPriceLine(
        chart.current.addLineSeries({ color: priceLineColor, lineWidth: 1 })
      );
      setStopLine(chart.current.addLineSeries({ color: `red`, lineWidth: 1 }));
      setProfitLine(
        chart.current.addLineSeries({ color: profitLineColor, lineWidth: 1 })
      );
      setOrderLine(
        chart.current.addLineSeries({ color: `gold`, lineWidth: 1 })
      );
      setSoldPriceLine(
        chart.current.addLineSeries({ color: `cyan`, lineWidth: 1 })
      );
    }

    return () => {
      chart.current.remove();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    if (chart.current) {
      chart.current
        .timeScale()
        .setVisibleLogicalRange({ from: 0.5, to: tm.prices.length - 1.5 });
    }
  }, [chart.current, tm.prices.length]);

  // refresh chart
  useEffect(() => {
    // change chart theme according to the current theme
    changeChartTheme(chart.current, theme);

    // Setting price series min move to number of digits after decimal point
    const precision = getPrecision(tm.currentPrice);
    const minMove = 1 / 10 ** precision;
    const priceFormat = { precision, minMove };

    if (priceLine) {
      priceLine.setData(map(tm.prices, (v) => v));
      priceLine.applyOptions({ color: priceLineColor, priceFormat });
    }

    if (stopLine) {
      stopLine.applyOptions({
        visible: !!tm.stopLimitPrice,
        // make dashed if config SellAtStopLimit is false
        lineStyle: !cfg.SellAtStopLimit ? LineStyle.Dashed : LineStyle.Solid,
        priceFormat,
      });
      stopLine.setData(map(tm.prices, () => tm.stopLimitPrice));
    }

    if (orderLine) {
      orderLine.applyOptions({
        visible: !!tm.tradeResult.quantity,
        priceFormat,
      });
      orderLine.setData(map(tm.prices, () => tm.tradeResult.price));
    }

    if (profitLine) {
      profitLine.applyOptions({
        color: profitLineColor,
        visible: !!tm.tradeResult.quantity,
        lineStyle: LineStyle.Dashed,
        priceFormat,
      });
      // FGI is from 1 to 3, which makes profit goal 30-10% of channel size
      const profitGoal = tm.range * (0.9 / cfg.AutoFGI);
      const profitPrice = tm.tradeResult.price * (1 + profitGoal);
      profitLine.setData(map(tm.prices, () => profitPrice));
    }

    if (soldPriceLine) {
      soldPriceLine.applyOptions({
        visible: tm.stateIs(TradeState.SOLD),
        priceFormat,
      });
      soldPriceLine.setData(map(tm.prices, () => tm.tradeResult.soldPrice));
    }
  }, [theme, tm, cfg.AutoFGI, priceLine, profitLine, stopLine, orderLine]);

  const [removed, setRemoved] = useState(false);

  function onDelete(): void {
    if (confirm(`Are you sure you want to remove ${coinName}?`)) {
      google.script.run
        .withSuccessHandler(() => setRemoved(true))
        .withFailureHandler(alert)
        .dropCoin(coinName);
    }
  }

  const curVal = tm.tradeResult.quantity * tm.currentPrice;
  const profit = tm.profit();
  return (
    <>
      {!removed && (
        <Card elevation={2}>
          <CardContent>
            <TradeTitle tradeMemo={tm} onDelete={onDelete} />
            <Box
              sx={chartStyle(theme)}
              width={chartOpts.width}
              height={chartOpts.height}
              ref={chartContainerRef}
              className="chart-container"
            />
          </CardContent>
          <CardContent sx={{ padding: `16px`, paddingTop: 0 }}>
            {tm.tradeResult.quantity && (
              <Typography variant="body2" color="text.secondary">
                <div>
                  {`Current value: ${f2(curVal)} (${profit > 0 ? `+` : ``}${f2(
                    profit
                  )})`}
                </div>
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

const chartStyle = (theme): {} => ({
  "& .tv-lightweight-charts": {
    borderRadius: `4px`,
    border: `1px solid ${theme.palette.text.disabled}`,
  },
});

function changeChartTheme(chart: IChartApi, theme: Theme): void {
  chart?.applyOptions({
    layout: {
      backgroundColor: theme.palette.background.default,
      textColor: theme.palette.text.primary,
    },
    grid: {
      vertLines: { color: theme.palette.divider },
      horzLines: { color: theme.palette.divider },
    },
  });
}
