import * as React from "react";
import { useState } from "react";
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
import { cardWidth, featureDisabledInfo, growthIconMap } from "./Common";
import {
  type AppState,
  type CandidateInfo,
  type CoinName,
  type Config,
  f0,
  Key,
  PriceMove,
  TradeMemo,
} from "../../lib";
import Asset from "./cards/Asset";
import Balance from "./cards/Balance";

export function Home({
  state,
  onAssetDelete,
}: {
  state: AppState;
  onAssetDelete?: (coinName: string, noConfirm?: boolean) => void;
}): JSX.Element {
  const config = state.config;
  const assets = state.assets.map(TradeMemo.fromObject);
  const assetsValue = assets.reduce((sum, tm) => sum + tm.currentValue, 0);
  const [hideBalances, setHideBalances] = useState(config.HideBalances);

  const toggleHideBalances = (): void => {
    setHideBalances(!hideBalances);
  };
  return (
    <>
      <Grid sx={{ flexGrow: 1 }} container spacing={2}>
        {balanceCard(config, hideBalances, assetsValue, toggleHideBalances)}
        {assetsCards(assets, hideBalances, config)}
        {candidates(state.candidates)}
      </Grid>
    </>
  );
}

function balanceCard(
  config: Config,
  hideBalances: boolean,
  assetsValue: number,
  toggleHideBalances: () => void
): JSX.Element {
  const [hide, setHide] = useState(false);

  return (
    <>
      <Grid item xs={12}>
        {/* Invisible divider */}
        <Divider sx={{ [`::before,::after`]: { borderTop: `none` } }}>
          <Chip
            onClick={() => {
              setHide(!hide);
            }}
            label={<Typography variant={`h6`}>💰 Balance</Typography>}
          />
        </Divider>
      </Grid>
      {!hide && (
        <Grid item xs={12}>
          <Grid container justifyContent="center" spacing={2}>
            <Grid item>
              <Balance
                name={config.StableCoin}
                balances={{
                  [config.StableCoin]: config.StableBalance,
                  feesBudget: config.FeesBudget,
                }}
                assetsValue={assetsValue}
                viewOnly={config.ViewOnly}
                hide={hideBalances}
                toggleHide={
                  config.HideBalances ? toggleHideBalances : undefined
                }
              />
            </Grid>
          </Grid>
        </Grid>
      )}
    </>
  );
}

function assetsCards(
  elems: TradeMemo[],
  hideBalances: boolean,
  config: Config
): JSX.Element {
  const [hide, setHide] = useState(false);

  const sorted = elems.sort((t1, t2) => (t1.ttl > t2.ttl ? 1 : -1));
  const current = sorted.filter((t) => t.currentValue);
  const sold = sorted.filter((t) => !t.currentValue);

  return (
    <>
      <Grid item xs={12}>
        <Divider sx={{ [`::before,::after`]: { borderTop: `none` } }}>
          <Chip
            onClick={() => {
              setHide(!hide);
            }}
            label={
              <Typography variant={`h6`}>
                🪙 Assets ({current.length})
              </Typography>
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
          {config.AdvancedAccess && !sorted.length && (
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
          {!!current.length && (
            <Grid item xs={12}>
              <Grid container justifyContent="center" spacing={2}>
                {current.map((t) => (
                  <Grid key={t.getCoinName()} item>
                    <Asset tm={t} cfg={config} hideBalances={hideBalances} />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}
          {!!sold.length && (
            <Grid item xs={12}>
              <Grid container justifyContent="center" spacing={2}>
                {sold.map((t) => (
                  <Grid key={t.getCoinName()} item>
                    <Asset tm={t} cfg={config} hideBalances={hideBalances} />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}
        </>
      )}
    </>
  );
}

const percentileToColorMap = {
  // Gradient from red to green, with keys from 0.1 to 0.9 and step 0.1
  0.0: `#ff0000`,
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

function candidates(data: Record<CoinName, CandidateInfo>): JSX.Element {
  const candidateCoins = Object.keys(data).sort((a, b) =>
    data[a][Key.STRENGTH] > data[b][Key.STRENGTH] ? -1 : 1
  );

  const [hide, setHide] = useState(false);

  return (
    <>
      <Grid item xs={12}>
        <Divider sx={{ [`::before,::after`]: { borderTop: `none` } }}>
          <Chip
            onClick={() => {
              setHide(!hide);
            }}
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
                    const ch = data[coin];
                    const strength = ch[Key.STRENGTH] ?? 0;
                    const priceMove = ch[Key.PRICE_MOVE] ?? PriceMove.NEUTRAL;
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
                            percentage={f0(strength * 100)}
                            stroke={percentileToColorMap[strength.toFixed(1)]}
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
                              {growthIconMap.get(priceMove)}
                            </Typography>
                          }
                          secondary={`Strength: ${f0(strength * 100)}`}
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
