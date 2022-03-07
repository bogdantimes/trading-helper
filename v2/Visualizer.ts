class V2TradeVisualizer implements TradeVisualizer {
  private readonly store: IStore;
  private readonly bnbPrice: number;

  constructor(store: IStore) {
    const HOUR = 60 * 60;
    const BNB_RPICE = "BNB_PRICE";

    this.store = store
    this.bnbPrice = +CacheService.getScriptCache().get(BNB_RPICE);
    if (!this.bnbPrice) {
      this.bnbPrice = new Binance(store).getPrice(new ExchangeSymbol("BNB", USDT));
      CacheService.getScriptCache().put(BNB_RPICE, String(this.bnbPrice), HOUR)
    }
  }

  render(): HtmlOutput {
    const renderedCharts: string[] = []
    Object.values(DefaultStore.getOrSet("trade", {}))
      .forEach((tradeMemoRaw: object) => {
        const tradeMemo = TradeMemo.fromObject(tradeMemoRaw);

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

        const maxLoss = tradeMemo.maxLoss.toFixed(2);
        const maxProfit = tradeMemo.maxProfit.toFixed(2);
        const chart = Charts.newLineChart()
          .setDataTable(data)
          .setYAxisTitle(`Price (${USDT})`)
          .setXAxisTitle(`Loss estimate: ${maxLoss} ${USDT}\nProfit estimate: ${maxProfit} ${USDT}`)
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

      })


    const htmlOutput = HtmlService.createHtmlOutput().setTitle('Trader bot');
    const statistics = new Statistics(this.store);

    const profit = statistics.getTotalProfit().toFixed(2);
    const commission = (statistics.getTotalCommission() * this.bnbPrice).toFixed(2);
    htmlOutput.append(`<h1 style="color: ${+profit >= 0 ? 'forestgreen' : 'orangered'}">Total profit: ${profit} ${USDT}</h1>`);
    htmlOutput.append(`<h3 style="color: darkorange">Total commission: ~ ${commission} ${USDT}</h3>`);
    renderedCharts.forEach(chart => {
      htmlOutput.append("<div><img src=\"" + chart + "\"></div>");
    })

    return htmlOutput;
  }

}
