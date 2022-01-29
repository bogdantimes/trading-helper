class V2TradeVisualizer implements TradeVisualizer {
  private store: IStore;

  constructor(store: IStore) {
    this.store = store
  }

  render(): HtmlOutput {
    const renderedCharts: string[] = []
    this.store.getKeys().filter(k => k.startsWith("trade/")).forEach(k => {
      const tradeMemoRaw = this.store.get(k);
      if (tradeMemoRaw) {
        const tradeMemo = TradeMemo.fromJSON(tradeMemoRaw);


        const orderPrice = tradeMemo.tradeResult.price;
        const data = Charts.newDataTable()
          .addColumn(Charts.ColumnType.NUMBER, 'X')
          .addColumn(Charts.ColumnType.NUMBER, 'Order')
          .addColumn(Charts.ColumnType.NUMBER, 'Price')
          .addColumn(Charts.ColumnType.NUMBER, 'Stop limit')
          .addRow([0, orderPrice, tradeMemo.prices[0], tradeMemo.stopLossPrice])
          .addRow([1, orderPrice, tradeMemo.prices[1], tradeMemo.stopLossPrice])
          .addRow([2, orderPrice, tradeMemo.prices[2], tradeMemo.stopLossPrice])

        const textStyle = Charts.newTextStyle().setColor('#e7e7e7').build();

        const chart = Charts.newLineChart()
          .setDataTable(data)
          .setYAxisTitle('Price')
          .setBackgroundColor('#0a1429')
          .setTitleTextStyle(textStyle)
          .setLegendTextStyle(textStyle)
          .setXAxisTextStyle(textStyle)
          .setYAxisTextStyle(textStyle)
          .setYAxisTitleTextStyle(textStyle)
          .setColors(["gold", "lightblue", "red"])
          .setTitle('trade/PEOPLE')
          .build();

        const imageData = Utilities.base64Encode(chart.getAs('image/png').getBytes());
        renderedCharts.push("data:image/png;base64," + encodeURI(imageData));

      }
    })


    const htmlOutput = HtmlService.createHtmlOutput().setTitle('Trader bot');

    renderedCharts.forEach(chart => {
      htmlOutput.append("<img src=\"" + chart + "\">");
    })

    return htmlOutput;
  }

}
