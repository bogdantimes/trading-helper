import * as React from "react";
import { useState } from "react";
import Trade from "./Trade";
import {
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from "@mui/material";
import SemiCircleProgressBar from "react-progressbar-semicircle";
import Balance from "./Balance";
import { capitalizeWord, cardWidth, growthIconMap } from "./Common";
import {
  AppState,
  ChannelState,
  Config,
  f0,
  Key,
  PriceChannelsDataResponse,
  PriceMove,
  StableUSDCoin,
  TradeMemo,
  TradeState,
} from "../../lib";

export function Assets({ state }: { state: AppState }): JSX.Element {
  const config = state.config;
  const assets = state.assets.map(TradeMemo.fromObject);
  const assetsValue = assets.reduce((sum, tm) => sum + tm.currentValue, 0);

  return (
    <>
      <Grid sx={{ flexGrow: 1 }} container spacing={2}>
        {getBalanceView(config.StableCoin, config.StableBalance, assetsValue)}
        {getTradeCards(TradeState.BOUGHT, assets, config)}
        {candidates(state.candidates)}
      </Grid>
    </>
  );
}

function getBalanceView(
  name: StableUSDCoin,
  balance: number,
  assetsValue: number
): JSX.Element {
  const [hide, setHide] = useState(false);

  return (
    <>
      <Grid item xs={12}>
        <Divider>
          <Chip onClick={() => setHide(!hide)} label="Balance" />
        </Divider>
      </Grid>
      {!hide && (
        <Grid item xs={12}>
          <Grid container justifyContent="center" spacing={2}>
            <Grid item>
              <Balance {...{ name, balance, assetsValue }} />
            </Grid>
          </Grid>
        </Grid>
      )}
    </>
  );
}

function getTradeCards(
  state: TradeState,
  elems: TradeMemo[],
  config?: Config
): JSX.Element {
  // hide Sold trades by default, others visible by default
  const [hide, setHide] = useState(state === TradeState.SOLD);
  return (
    <>
      <Grid item xs={12}>
        <Divider>
          <Chip
            onClick={() => setHide(!hide)}
            label={`${capitalizeWord(state)} (${elems.length})`}
          />
        </Divider>
      </Grid>
      {!hide && (
        <Grid item xs={12}>
          <Grid container justifyContent="center" spacing={2}>
            {elems
              .sort((t1, t2) => (t1.profit() < t2.profit() ? 1 : -1))
              .map((t) => (
                <Grid key={t.getCoinName()} item>
                  <Trade data={t} config={config} />
                </Grid>
              ))}
          </Grid>
        </Grid>
      )}
    </>
  );
}

const percentileToColorMap = {
  // Gradient from red to green, with keys from 0.1 to 0.9 and step 0.1
  0.1: `#ff0000`,
  0.2: `#ff3300`,
  0.3: `#ff6600`,
  0.4: `#ff9900`,
  0.5: `#ffcc00`,
  0.6: `#ffff00`,
  0.7: `#ccff00`,
  0.8: `#99ff00`,
  0.9: `#66ff00`,
};

function candidates(data: PriceChannelsDataResponse): JSX.Element {
  const candidateCoins = Object.keys(data).sort((a, b) =>
    data[a][Key.PERCENTILE] > data[b][Key.PERCENTILE] ? -1 : 1
  );

  const stateIcon = {
    [ChannelState.NONE]: growthIconMap.get(PriceMove.NEUTRAL),
    [ChannelState.TOP]: growthIconMap.get(PriceMove.UP),
    [ChannelState.BOTTOM]: growthIconMap.get(PriceMove.DOWN),
    [ChannelState.MIDDLE]: growthIconMap.get(PriceMove.NEUTRAL),
  };

  const [hide, setHide] = useState(true);

  return (
    <>
      <Grid item xs={12}>
        <Divider>
          <Chip
            onClick={() => setHide(!hide)}
            label={`Candidates (${candidateCoins.length})`}
          />
        </Divider>
      </Grid>
      {!hide && (
        <Grid item xs={12}>
          <Grid container justifyContent="center" spacing={2}>
            <Grid item>
              {!candidateCoins.length && (
                <Typography alignSelf={`center`} variant={`body2`}>
                  Nothing to show yet. Investment candidates will appear after
                  some
                  {` `}
                  period of observation.
                </Typography>
              )}
              {!!candidateCoins.length && (
                <List
                  sx={{
                    padding: 0,
                    marginTop: 0,
                    width: cardWidth,
                    overflow: `auto`,
                    maxHeight: 440,
                  }}
                >
                  {candidateCoins.map((coin, i) => {
                    const {
                      [Key.PERCENTILE]: percentile,
                      [Key.S0]: s0,
                      [Key.S1]: s1,
                      [Key.S2]: s2,
                    } = data[coin];
                    return (
                      <ListItem
                        sx={{
                          padding: `0 0 6px 60px`,
                        }}
                        key={i}
                        disablePadding={true}
                      >
                        <ListItemAvatar>
                          <SemiCircleProgressBar
                            diameter={80}
                            percentage={f0(percentile * 100)}
                            stroke={percentileToColorMap[percentile.toFixed(1)]}
                            strokeWidth={10}
                          />
                        </ListItemAvatar>
                        <ListItemText
                          sx={{ margin: `-3px 0 0 8px` }}
                          primary={
                            <Typography
                              sx={{ display: `flex`, alignItems: `center` }}
                            >
                              {coin}
                              {stateIcon[s2]} {stateIcon[s1]} {stateIcon[s0]}
                            </Typography>
                          }
                          secondary={`Strength: ${f0(percentile * 100)}`}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </Grid>
          </Grid>
        </Grid>
      )}
    </>
  );
}
