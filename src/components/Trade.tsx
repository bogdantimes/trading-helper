import * as React from 'react';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import {XYPlot, XAxis, YAxis, HorizontalGridLines, LineSeries} from 'react-vis';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {CardHeader} from "@mui/material";
import {TradeMemo} from "../../apps-script/TradeMemo";

export default function Trade(props) {
  const tradeMemo: TradeMemo = props.data;
  return (
    <Card sx={{maxWidth: 345}}>
      <CardHeader title={props.name}/>
      <XYPlot xType="linear" width={300} height={200}>
        <HorizontalGridLines/>
        <XAxis hideTicks/>
        <YAxis title="Price"/>
        <LineSeries
          data={tradeMemo.prices.map((price, index) => ({x: index + 1, y: price}))}
        />
        <LineSeries
          data={[].fill(tradeMemo.prices.length, tradeMemo.stopLossPrice)
            .map((price, index) => ({x: index + 1, y: price}))}
        />
      </XYPlot>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          <div>Total: 0.00 (0.00%)</div>
          <div>Profit: 0.00 (0.00%)</div>
          <div>Loss: 0.00 (0.00%)</div>
        </Typography>
      </CardContent>
      <CardActions>
        <Button size="small">Sell</Button>
        <Button size="small">Buy More</Button>
      </CardActions>
    </Card>
  );
}
