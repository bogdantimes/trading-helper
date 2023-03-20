import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CurrencyFormat from "react-currency-format";
import {
  type ChartOptions,
  ColorType,
  createChart,
  type DeepPartial,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  LineStyle,
} from "lightweight-charts";
import { Box, type Theme, useTheme } from "@mui/material";
import { TradeTitle } from "./TradeTitle";
import {
  type Config,
  f2,
  getPrecision,
  SHORT_MASK,
  type TradeMemo,
} from "../../lib";
import { type SxProps } from "@mui/system/styleFunctionSx";

export default function Trade(props: {
  data: TradeMemo;
  config: Config;
  hideBalances: boolean;
  onDelete?: (coinName: string, noConfirm?: boolean) => void;
}): JSX.Element {
  const { data: tm, config: cfg, onDelete } = props;

  const chartContainerRef = useRef();
  const chart = useRef<IChartApi>();
  const theme = useTheme();

  const [priceLine, setPriceLine] = useState<ISeriesApi<`Line`>>();
  const [targetLine, setTargetLine] = useState<ISeriesApi<`Line`>>();
  const [stopLine, setStopLine] = useState<ISeriesApi<`Line`>>();
  const [entryLine, setEntryLine] = useState<ISeriesApi<`Line`>>();
  const [soldPriceLine, setSoldPriceLine] = useState<ISeriesApi<`Line`>>();

  const map = (prices: number[], mapFn: (v: number) => number): LineData[] => {
    return prices.map((v, i) => ({
      time: `${2000 + i}-01-01`,
      value: mapFn(v),
    }));
  };

  const chartOpts: DeepPartial<ChartOptions> = {
    width: 300,
    height: tm.tradeResult.soldPrice ? 100 : 200,
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

  const priceLineLabel = `Price ${f2(
    (tm.currentPrice * 100) / tm.tradeResult.entryPrice - 100
  )}%`;
  const stopLineLabel = `Smart exit ${f2(
    (tm.smartExitPrice * 100) / tm.tradeResult.entryPrice - 100
  )}%`;
  const targetLineLabel = `Profit goal ${f2(tm.profitGoal * 100)}%`;

  useEffect(() => {
    if (!chart.current) {
      chart.current = createChart(chartContainerRef.current ?? ``, chartOpts);

      setPriceLine(
        chart.current.addLineSeries({
          title: priceLineLabel,
          color: priceColor,
          lineWidth: 1,
        })
      );
      setStopLine(
        chart.current.addLineSeries({
          title: stopLineLabel,
          color: stopColor,
          lineWidth: 1,
        })
      );
      setTargetLine(
        chart.current.addLineSeries({
          title: targetLineLabel,
          color: profitColor,
          lineWidth: 1,
        })
      );
      setEntryLine(
        chart.current.addLineSeries({
          title: `Entry price`,
          color: entryColor,
          lineWidth: 1,
        })
      );
      setSoldPriceLine(
        chart.current.addLineSeries({
          title: `Exit price ${f2(tm.profitPercent())}%`,
          color: exitColor,
          lineWidth: 1,
        })
      );
    }

    return () => {
      chart.current?.remove();
      chart.current = undefined;
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
    if (chart.current) {
      changeChartTheme(chart.current, theme);
    }

    // Setting price series min move to number of digits after decimal point
    const precision = getPrecision(tm.currentPrice);
    const minMove = 1 / 10 ** precision;
    const priceFormat = { precision, minMove };

    if (priceLine) {
      priceLine.setData(map(tm.prices, (v) => v));
      priceLine.applyOptions({
        title: priceLineLabel,
        color: priceColor,
        priceFormat,
      });
    }

    if (stopLine) {
      stopLine.applyOptions({
        title: stopLineLabel,
        visible: !!tm.smartExitPrice,
        // make dashed if config SellAtStopLimit is false
        lineStyle: !cfg.SellAtStopLimit ? LineStyle.Dashed : LineStyle.Solid,
        priceFormat,
      });
      stopLine.setData(map(tm.prices, () => tm.smartExitPrice));
    }

    if (entryLine) {
      entryLine.applyOptions({
        visible: !!tm.tradeResult.entryPrice,
        priceFormat,
      });
      entryLine.setData(map(tm.prices, () => tm.tradeResult.entryPrice));
    }

    if (targetLine) {
      targetLine.applyOptions({
        title: targetLineLabel,
        color: profitColor,
        visible: !!tm.tradeResult.quantity,
        lineStyle: LineStyle.Dashed,
        priceFormat,
      });
      const profitGoalPrice = tm.profitGoalPrice;
      targetLine.setData(map(tm.prices, () => profitGoalPrice));
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
    targetLine,
    stopLine,
    entryLine,
  ]);

  useEffect(() => {
    if (chart.current) {
      chart.current.resize(300, tm.tradeResult.soldPrice ? 100 : 200);
    }
  }, [chart.current, tm.tradeResult.soldPrice]);

  const curVal = tm.currentValue;
  const gained = tm.tradeResult.gained;
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
                <b>
                  {tm.tradeResult.soldPrice ? `Gained: ` : `Current value: `}
                </b>
                {props.hideBalances ? (
                  <span>${SHORT_MASK}</span>
                ) : (
                  <>
                    <CurrencyFormat
                      value={tm.tradeResult.soldPrice ? gained : curVal}
                      displayType={`text`}
                      thousandSeparator={true}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      prefix={`$`}
                    />
                    <span>{` (${profit > 0 ? `+` : ``}${f2(profit)})`}</span>
                  </>
                )}
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

const chartStyle = (theme): SxProps => ({
  "& .tv-lightweight-charts": {
    borderRadius: `4px`,
    border: `1px solid ${theme.palette.text.disabled}`,
  },
});

function changeChartTheme(chart: IChartApi, theme: Theme): void {
  chart?.applyOptions({
    layout: {
      background: {
        type: ColorType.Solid,
        color: theme.palette.background.default,
      },
      textColor: theme.palette.text.primary,
    },
    grid: {
      vertLines: { color: theme.palette.divider },
      horzLines: { color: theme.palette.divider },
    },
  });
}
