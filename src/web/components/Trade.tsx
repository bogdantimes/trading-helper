import * as React from "react"
import { useEffect, useRef, useState } from "react"
import Card from "@mui/material/Card"
import CardActions from "@mui/material/CardActions"
import CardContent from "@mui/material/CardContent"
import Typography from "@mui/material/Typography"
import {
  ChartOptions,
  createChart,
  DeepPartial,
  IChartApi,
  ISeriesApi,
  LineStyle,
  PriceScaleMode,
} from "lightweight-charts"
import { Box, Stack, Theme, ToggleButton, useTheme } from "@mui/material"
import { circularProgress } from "./Common"
import { TradeTitle } from "./TradeTitle"
import { Config, f2, TradeMemo, TradeState } from "../../lib"

export default function Trade(props: { data: TradeMemo; config: Config }) {
  const { data: tm, config } = props
  const coinName = tm.getCoinName()

  const chartContainerRef = useRef()
  const chart = useRef<IChartApi>(null)
  const theme = useTheme()

  const [priceLine, setPriceLine] = useState<ISeriesApi<`Line`>>(null)
  const [profitLine, setProfitLine] = useState<ISeriesApi<`Line`>>(null)
  const [limitLine, setLimitLine] = useState<ISeriesApi<`Line`>>(null)
  const [orderLine, setOrderLine] = useState<ISeriesApi<`Line`>>(null)
  const [soldPriceLine, setSoldPriceLine] = useState<ISeriesApi<`Line`>>(null)

  const map = (prices: number[], mapFn: (v: number) => number) => {
    return prices.map((v, i) => ({ time: `${2000 + i}-01-01`, value: mapFn(v) }))
  }

  const chartOpts: DeepPartial<ChartOptions> = {
    width: 300,
    height: 200,
    timeScale: { visible: false },
    handleScroll: false,
    handleScale: false,
    rightPriceScale: {
      mode: PriceScaleMode.Logarithmic,
    },
  }

  // In dark more 'lightblue' color price line looks better
  const priceLineColor = theme.palette.mode === `light` ? `blue` : `lightblue`
  const profitLineColor = theme.palette.mode === `light` ? `green` : `lightgreen`

  useEffect(() => {
    if (!chart.current) {
      chart.current = createChart(chartContainerRef.current, chartOpts)

      setPriceLine(chart.current.addLineSeries({ color: priceLineColor, lineWidth: 1 }))
      setLimitLine(chart.current.addLineSeries({ color: `red`, lineWidth: 1 }))
      setProfitLine(chart.current.addLineSeries({ color: profitLineColor, lineWidth: 1 }))
      setOrderLine(chart.current.addLineSeries({ color: `gold`, lineWidth: 1 }))
      setSoldPriceLine(chart.current.addLineSeries({ color: `cyan`, lineWidth: 1 }))
    }

    return () => {
      chart.current.remove()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    if (chart.current) {
      chart.current.timeScale().setVisibleLogicalRange({ from: 0.5, to: tm.prices.length - 1.5 })
    }
  }, [chart.current, tm.prices.length])

  // refresh chart
  useEffect(() => {
    // change chart theme according to the current theme
    changeChartTheme(chart.current, theme)

    if (priceLine) {
      priceLine.setData(map(tm.prices, (v) => v))
      priceLine.applyOptions({ color: priceLineColor })
    }

    if (limitLine) {
      limitLine.applyOptions({
        // hide if HODLing or no stop limit price
        visible: !!tm.stopLimitPrice && !config.HODL.includes(coinName),
        // make dashed if config SellAtStopLimit is false
        lineStyle: !config.SellAtStopLimit ? LineStyle.Dashed : LineStyle.Solid,
      })
      limitLine.setData(map(tm.prices, () => tm.stopLimitPrice))
    }

    if (orderLine) {
      orderLine.applyOptions({ visible: !!tm.tradeResult.quantity })
      orderLine.setData(map(tm.prices, () => tm.tradeResult.price))
    }

    if (profitLine) {
      profitLine.applyOptions({
        color: profitLineColor,
        // hide if HODLing or no quantity
        visible: !!tm.tradeResult.quantity && !config.HODL.includes(coinName),
        // make dashed if config SellAtProfitLimit is false
        lineStyle: !config.SellAtProfitLimit ? LineStyle.Dashed : LineStyle.Solid,
      })
      const profitPrice = tm.tradeResult.price * (1 + config.ProfitLimit)
      profitLine.setData(map(tm.prices, () => profitPrice))
    }

    if (soldPriceLine) {
      soldPriceLine.applyOptions({ visible: tm.stateIs(TradeState.SOLD) })
      soldPriceLine.setData(map(tm.prices, () => tm.tradeResult.soldPrice))
    }
  }, [theme, tm, config, priceLine, profitLine, limitLine, orderLine])

  const [isHodlSwitching, setIsHodlSwitching] = useState(false)
  const [isHodl, setIsHodl] = useState(config.HODL.includes(coinName))

  useEffect(() => setIsHodl(config.HODL.includes(coinName)), [config.HODL])

  function flipHodl() {
    setIsHodlSwitching(true)
    google.script.run
      .withSuccessHandler(() => {
        setIsHodl(!isHodl)
        setIsHodlSwitching(false)
      })
      .withFailureHandler((resp) => {
        alert(resp.toString())
        setIsHodlSwitching(false)
      })
      .setHold(coinName, !isHodl)
  }

  const [removed, setRemoved] = useState(false)

  function onDelete() {
    if (confirm(`Are you sure you want to remove ${coinName}?`)) {
      google.script.run
        .withSuccessHandler(() => setRemoved(true))
        .withFailureHandler(alert)
        .dropCoin(coinName)
    }
  }

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
          {tm.tradeResult.quantity ? (
            <Typography marginLeft={`16px`} variant="body2" color="text.secondary">
              <div>
                Qty: {tm.tradeResult.quantity} Paid: {f2(tm.tradeResult.paid)} TTL:{` `}
                {config.TTL - tm.ttl}
              </div>
              <div>
                {tm.profit() >= 0 ? `Profit` : `Loss`}: {f2(tm.profit())} ({f2(tm.profitPercent())}
                %)
              </div>
              <div>
                Stop: {f2(tm.stopLimitLoss())} ({f2(tm.stopLimitLossPercent())}%)
              </div>
            </Typography>
          ) : (
            !!tm.soldPriceChangePercent() && (
              <Typography marginLeft={`16px`} variant="body2" color="text.secondary">
                <div>Gap: {f2(tm.soldPriceChangePercent())}%</div>
              </Typography>
            )
          )}
          <CardActions>
            <Stack direction={`row`} spacing={1} sx={{ marginLeft: `auto`, marginRight: `auto` }}>
              {tm.stateIs(TradeState.BOUGHT) && (
                <Box sx={{ position: `relative` }}>
                  <ToggleButton
                    size="small"
                    value="check"
                    selected={isHodl}
                    color="primary"
                    onChange={flipHodl}
                    disabled={isHodlSwitching}
                  >
                    HODL
                  </ToggleButton>
                  {isHodlSwitching && circularProgress}
                </Box>
              )}
            </Stack>
          </CardActions>
        </Card>
      )}
    </>
  )
}

const chartStyle = (theme) => ({
  "& .tv-lightweight-charts": {
    borderRadius: `4px`,
    border: `1px solid ${theme.palette.text.disabled}`,
  },
})

function changeChartTheme(chart: IChartApi, theme: Theme) {
  chart &&
    chart.applyOptions({
      layout: {
        backgroundColor: theme.palette.background.default,
        textColor: theme.palette.text.primary,
      },
      grid: {
        vertLines: { color: theme.palette.divider },
        horzLines: { color: theme.palette.divider },
      },
    })
}
