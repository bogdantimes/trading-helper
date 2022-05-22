import * as React from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { Config } from '../../gas/Store'
import { TradeMemo } from '../../shared-lib/TradeMemo'
import { f2 } from '../../shared-lib/functions'

type StableCoinProps = {
  tradeNotAllowed: boolean;
  data: TradeMemo;
  config: Config;
};

export default function StableCoin({ data: tradeMemo }: StableCoinProps) {
  const coinName = tradeMemo.getCoinName()

  return (
    <>
      <Card sx={{ width: 332 }}>
        <CardContent sx={{ paddingBottom: 0 }}>
          <Typography variant='h5'>{coinName}</Typography>
          <Typography variant='h6'>
            {f2(tradeMemo.tradeResult.quantity)}
          </Typography>
        </CardContent>
      </Card>
    </>
  )
}
