import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CurrencyFormat from "react-currency-format";
import {
  ChartOptions,
  createChart,
  DeepPartial,
  IChartApi,
  ISeriesApi,
  LineData,
  LineStyle,
} from "lightweight-charts";
import { Box, Theme, useTheme } from "@mui/material";
import { TradeTitle } from "./TradeTitle";
import { Config, f2, getPrecision, TradeMemo } from "../../lib";

export default function Trade(props: {
  data: TradeMemo;
  config: Config;
  onDelete: (coinName: string) => void;
}): JSX.Element {
  const { data: tm, config: cfg, onDelete } = props;

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
    handleScroll: false,
    handleScale: false,
    timeScale: { visible: false },
  };

  const entryColor = `gold`;
  const stopColor = `red`;
  const exitColor = `cyan`;
  // In dark more 'lightblue' color price line looks better
  const priceColor = theme.palette.mode === `light` ? `blue` : `lightblue`;
  const profitColor = theme.palette.mode === `light` ? `green` : `lightgreen`;

  useEffect(() => {
    if (!chart.current) {
      chart.current = createChart(chartContainerRef.current, chartOpts);

      setPriceLine(
        chart.current.addLineSeries({
          title: `Price`,
          color: priceColor,
          lineWidth: 1,
        })
      );
      setStopLine(
        chart.current.addLineSeries({
          title: `Stop-limit`,
          color: stopColor,
          lineWidth: 1,
        })
      );
      setProfitLine(
        chart.current.addLineSeries({
          title: `Profit goal`,
          color: profitColor,
          lineWidth: 1,
        })
      );
      setOrderLine(
        chart.current.addLineSeries({
          title: `Entry price`,
          color: entryColor,
          lineWidth: 1,
        })
      );
      setSoldPriceLine(
        chart.current.addLineSeries({
          title: `Exit price`,
          color: exitColor,
          lineWidth: 1,
        })
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
      priceLine.applyOptions({ color: priceColor, priceFormat });
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
        color: profitColor,
        visible: !!tm.tradeResult.quantity,
        lineStyle: LineStyle.Dashed,
        priceFormat,
      });
      const profitPrice = tm.profitGoalPrice();
      profitLine.setData(map(tm.prices, () => profitPrice));
    }

    if (soldPriceLine) {
      soldPriceLine.applyOptions({
        visible: !!tm.tradeResult.soldPrice,
        priceFormat,
      });
      soldPriceLine.setData(map(tm.prices, () => tm.tradeResult.soldPrice));
    }
  }, [
    theme,
    tm,
    cfg.AutoMarketTrend,
    priceLine,
    profitLine,
    stopLine,
    orderLine,
  ]);

  useEffect(() => {
    if (chart.current) {
      chart.current.resize(300, tm.tradeResult.soldPrice ? 100 : 200);
    }
  }, [chart.current, tm.tradeResult.soldPrice]);

  const curVal = tm.currentValue;
  const profit = tm.profit();
  return (
    <>
      {
        <Card elevation={2}>
          <CardContent>
            <TradeTitle tradeMemo={tm} onDelete={onDelete} />
            {
              <Typography
                margin={`-2px 0 8px`}
                variant="body2"
                color="text.secondary"
                gutterBottom
              >
                <b>Current value: </b>
                <CurrencyFormat
                  value={curVal}
                  displayType={`text`}
                  thousandSeparator={true}
                  decimalScale={2}
                  fixedDecimalScale={true}
                  prefix={`$`}
                />
                <span>{` (${profit > 0 ? `+` : ``}${f2(profit)})`}</span>
              </Typography>
            }
            <Box
              sx={chartStyle(theme)}
              width={chartOpts.width}
              height={chartOpts.height}
              ref={chartContainerRef}
              className="chart-container"
            />
          </CardContent>
        </Card>
      }
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
