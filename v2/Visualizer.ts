class V2TradeVisualizer implements TradeVisualizer {
  private store: IStore;

  constructor(store: IStore) {
    this.store = store
  }

  render(): HtmlOutput {
    const renderedCharts: string[] = []
    this.store.getKeys().filter(TradeMemoKey.isKey).forEach(k => {
      const tradeMemoRaw = this.store.get(k);
      if (tradeMemoRaw) {
        const tradeMemo = TradeMemo.fromJSON(tradeMemoRaw);

        const orderPrice = tradeMemo.tradeResult.price;
        const data = Charts.newDataTable()
          .addColumn(Charts.ColumnType.NUMBER, 'X')
          .addColumn(Charts.ColumnType.NUMBER, 'Order')
          .addColumn(Charts.ColumnType.NUMBER, 'Price')
          .addColumn(Charts.ColumnType.NUMBER, 'Stop limit')

        tradeMemo.prices.forEach((p, i) => {
          data.addRow([i, orderPrice, tradeMemo.prices[i], tradeMemo.stopLossPrice])
        })

        const textStyle = Charts.newTextStyle().setColor('#e7e7e7').build();

        const chart = Charts.newLineChart()
          .setDataTable(data)
          .setYAxisTitle('Price')
          .setXAxisTitle(`Profit estimate: ${tradeMemo.profitEstimate.toFixed(2)}`)
          .setBackgroundColor('#081f21')
          .setTitleTextStyle(textStyle)
          .setLegendTextStyle(textStyle)
          .setXAxisTextStyle(textStyle)
          .setYAxisTextStyle(textStyle)
          .setYAxisTitleTextStyle(textStyle)
          .setXAxisTitleTextStyle(textStyle)
          .setOption("hAxis.gridlines.color", '#1f3564')
          .setOption("vAxis.gridlines.color", '#1f3564')
          .setColors(["gold", "lightblue", "red"])
          .setTitle(tradeMemo.getKey().toString())
          .build();

        const imageData = Utilities.base64Encode(chart.getAs('image/png').getBytes());
        renderedCharts.push("data:image/png;base64," + encodeURI(imageData));

      }
    })


    const htmlOutput = HtmlService.createHtmlOutput().setTitle('Trader bot');

    renderedCharts.forEach(chart => {
      htmlOutput.append("<div><img src=\"" + chart + "\"></div>");
    })

    return htmlOutput;
  }

}
