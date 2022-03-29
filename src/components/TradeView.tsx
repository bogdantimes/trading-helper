import * as React from 'react';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import {XYPlot, XAxis, YAxis, HorizontalGridLines, LineSeries} from 'react-vis';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {CardHeader} from "@mui/material";

export default function TradeView() {
  return (
    <Card sx={{maxWidth: 345}}>
      <CardHeader title="trade/SOL" />
      <XYPlot xType="linear" width={300} height={200}>
        <HorizontalGridLines />
        <XAxis hideTicks/>
        <YAxis title="Price"/>
        <LineSeries
          data={[{x: 1, y: 15}, {x: 2, y: 16}, {x: 3, y: 15}]}
        />
        <LineSeries
          data={[{x: 1, y: 17}, {x: 2, y: 17}, {x: 3, y: 17}]}
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
