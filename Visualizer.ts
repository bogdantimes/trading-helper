import HtmlOutput = GoogleAppsScript.HTML.HtmlOutput;

interface TradeVisualizer {
  render(memo: TradeMemo): HtmlOutput
}
