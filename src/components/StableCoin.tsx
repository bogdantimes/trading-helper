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
import {f2} from "./Common";

export default function StableCoin(props) {
  const tm: TradeMemo = props.data;
  const config: Config = props.config;

  const [isSelling, setIsSelling] = useState(false);

  function onSell() {
    if (confirm(`Are you sure you want to sell ${props.name}? ${config.AveragingDown ? "Averaging down is enabled. All gained money will be re-invested to the most unprofitable coin." : ""}`)) {
      setIsSelling(true);
      const handle = resp => {
        alert(resp.toString());
        setIsSelling(false);
      };
      // @ts-ignore
      google.script.run.withSuccessHandler(handle).withFailureHandler(handle).sellCoin(props.name);
    }
  }

  const [isBuying, setIsBuying] = useState(false);

  function onBuy() {
    if (confirm(`Are you sure you want to buy ${props.name}?`)) {
      setIsBuying(true);
      const handle = resp => {
        alert(resp.toString());
        setIsBuying(false);
      };
      // @ts-ignore
      google.script.run.withSuccessHandler(handle).withFailureHandler(handle).buyCoin(props.name);
    }
  }

  const [actionCanceled, setActionCanceled] = useState(false);

  function onCancel() {
    if (confirm(`Are you sure you want to cancel the action on ${props.name}?`)) {
      const handle = resp => {
        alert(resp.toString());
        setActionCanceled(true);
      };
      // @ts-ignore
      google.script.run.withSuccessHandler(handle).withFailureHandler(alert).cancelAction(props.name);
    }
  }

  const [isRemoving, setIsRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);

  function onRemove() {
    if (confirm(`Are you sure you want to remove ${props.name}?`)) {
      setIsRemoving(true);
      // @ts-ignore
      google.script.run
        .withSuccessHandler(() => {
          setIsRemoving(false);
          setRemoved(true);
        })
        .withFailureHandler(resp => {
          alert(resp.toString());
          setIsRemoving(false);
        })
        .dropCoin(props.name);
    }
  }

  const isCurrentStable = tm.getCoinName() === config.StableCoin;
  return (
    <>
      {!removed &&
        <Card sx={{width: 332}}>
          <CardContent sx={{paddingBottom: 0}}>
            <Typography variant="h5">{props.name}</Typography>
            <Typography variant="h6">{f2(tm.tradeResult.quantity)}</Typography>
          </CardContent>
          <CardActions disableSpacing={true}>
            <Stack direction={"row"} spacing={1}>
              {tm.stateIs(TradeState.BOUGHT) &&
                <Button size="small" disabled={isSelling || isCurrentStable}
                        onClick={onSell}>{isSelling ? '...' : 'Sell'}</Button>
              }
              {[TradeState.BOUGHT, TradeState.SOLD].includes(tm.getState()) &&
                <Button size="small" disabled={isBuying || isCurrentStable} onClick={onBuy}>
                  {isBuying ? '...' : `Buy ${tm.stateIs(TradeState.BOUGHT) ? 'More' : 'Again'}`}</Button>
              }
              {tm.stateIs(TradeState.SOLD) &&
                <Button size="small" disabled={isRemoving} onClick={onRemove}>{isRemoving ? '...' : 'Remove'}</Button>
              }
              {[TradeState.BUY, TradeState.SELL].includes(tm.getState()) &&
                <Button size="small" disabled={actionCanceled} onClick={onCancel}>Cancel</Button>
              }
            </Stack>
          </CardActions>
        </Card>
      }
    </>
  );
}
