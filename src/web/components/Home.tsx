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
import { cardWidth, featureDisabledInfo, growthIconMap } from "./Common";
import {
  AppState,
  ChannelState,
  Config,
  f0,
  Key,
  PriceChannelsDataResponse,
  StableUSDCoin,
  TradeMemo,
} from "../../lib";

export function Home({ state }: { state: AppState }): JSX.Element {
  const config = state.config;
  const assets = state.assets.map(TradeMemo.fromObject);
  const assetsValue = assets.reduce((sum, tm) => sum + tm.currentValue, 0);

  return (
    <>
      <Grid sx={{ flexGrow: 1 }} container spacing={2}>
        {balanceCard(config.StableCoin, config.StableBalance, assetsValue)}
        {assetsCards(assets, config)}
        {candidates(state.candidates)}
      </Grid>
    </>
  );
}

function balanceCard(
  name: StableUSDCoin,
  balance: number,
  assetsValue: number
): JSX.Element {
  const [hide, setHide] = useState(false);

  return (
    <>
      <Grid item xs={12}>
        {/* Invisible divider */}
        <Divider sx={{ [`::before,::after`]: { borderTop: `none` } }}>
          <Chip
            onClick={() => setHide(!hide)}
            label={<Typography variant={`h6`}>💰 Balance</Typography>}
          />
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

function assetsCards(elems: TradeMemo[], config: Config): JSX.Element {
  const [hide, setHide] = useState(false);
  return (
    <>
      <Grid item xs={12}>
        <Divider sx={{ [`::before,::after`]: { borderTop: `none` } }}>
          <Chip
            onClick={() => setHide(!hide)}
            label={
              <Typography variant={`h6`}>🪙 Assets ({elems.length})</Typography>
            }
          />
        </Divider>
      </Grid>
      {!hide && (
        <>
          {!config.AdvancedAccess && (
            <Grid item xs={12}>
              <Grid container justifyContent="center" spacing={2}>
                <Grid item>{featureDisabledInfo}</Grid>
              </Grid>
            </Grid>
          )}
          {config.AdvancedAccess && !elems.length && (
            <Grid item xs={12}>
              <Grid container justifyContent="center" spacing={2}>
                <Grid item>
                  <Typography variant="body1">
                    {config.ViewOnly
                      ? `🔕 Auto-trading is disabled. Toggle off "View-only" in Settings to activate.`
                      : `⌚ Waiting for specific conditions to buy a candidate.`}
                  </Typography>
                </Grid>
              </Grid>
            </Grid>
          )}
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
        </>
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

  const [hide, setHide] = useState(false);

  return (
    <>
      <Grid item xs={12}>
        <Divider sx={{ [`::before,::after`]: { borderTop: `none` } }}>
          <Chip
            onClick={() => setHide(!hide)}
            label={
              <Typography variant={`h6`}>
                {`⚖️ `}Candidates ({candidateCoins.length})
              </Typography>
            }
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
                      [Key.PRICE_MOVE]: priceMove,
                      [Key.S0]: s0,
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
                              {s0 === ChannelState.TOP ? <b>coin</b> : coin}
                              {growthIconMap.get(priceMove)}
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
