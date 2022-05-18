import * as React from 'react';
import {useState} from 'react';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {TradeMemo, TradeState} from "../../apps-script/TradeMemo";
import {Config} from "../../apps-script/Store";
import {Stack} from "@mui/material";
import {confirmBuy, confirmSell, f2} from "./Common";

export default function StableCoin(props: { tradeNotAllowed: boolean, data: TradeMemo, config: Config }) {
  const tm: TradeMemo = props.data;
  const config: Config = props.config;
  const tradeNotAllowed: boolean = props.tradeNotAllowed;
  const coinName = tm.getCoinName();

  const [isSelling, setIsSelling] = useState(false);

  function onSell() {
    if (confirmSell(coinName, config)) {
      setIsSelling(true);
      const handle = resp => {
        alert(resp.toString());
        setIsSelling(false);
      };
      google.script.run.withSuccessHandler(handle).withFailureHandler(handle).sellCoin(coinName);
    }
  }

  const [isBuying, setIsBuying] = useState(false);

  function onBuy() {
    if (confirmBuy(coinName, config)) {
      setIsBuying(true);
      const handle = resp => {
        alert(resp.toString());
        setIsBuying(false);
      };
      google.script.run.withSuccessHandler(handle).withFailureHandler(handle).buyCoin(coinName);
    }
  }

  const [actionCanceled, setActionCanceled] = useState(false);

  function onCancel() {
    if (confirm(`Are you sure you want to cancel the action on ${coinName}?`)) {
      const handle = resp => {
        alert(resp.toString());
        setActionCanceled(true);
      };
      google.script.run.withSuccessHandler(handle).withFailureHandler(alert).cancelAction(coinName);
    }
  }

  return (
    <>
      <Card sx={{width: 332}}>
        <CardContent sx={{paddingBottom: 0}}>
          <Typography variant="h5">{coinName}</Typography>
          <Typography variant="h6">{f2(tm.tradeResult.quantity)}</Typography>
        </CardContent>
        <CardActions disableSpacing={true}>
          <Stack direction={"row"} spacing={1}>
            {tm.stateIs(TradeState.BOUGHT) &&
              <Button size="small" disabled={isSelling || tradeNotAllowed}
                      onClick={onSell}>{isSelling ? '...' : 'Sell'}</Button>
            }
            {[TradeState.BOUGHT, TradeState.SOLD].includes(tm.getState()) &&
              <Button size="small" disabled={isBuying || tradeNotAllowed} onClick={onBuy}>
                {isBuying ? '...' : `Buy ${tm.stateIs(TradeState.BOUGHT) ? 'More' : 'Again'}`}</Button>
            }
            {[TradeState.BUY, TradeState.SELL].includes(tm.getState()) &&
              <Button size="small" disabled={actionCanceled} onClick={onCancel}>Cancel</Button>
            }
          </Stack>
        </CardActions>
      </Card>
    </>
  );
}
