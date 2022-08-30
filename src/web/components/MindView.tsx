import * as React from "react";
import { useEffect } from "react";
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { cardWidth, circularProgress, growthIconMap } from "./Common";
import {
  ChannelState,
  Config,
  f8,
  Key,
  PriceChannelData,
  PriceChannelsDataResponse,
  PriceMove,
} from "../../lib";
import { Save } from "@mui/icons-material";

function uploadData(
  priceChannelsData: PriceChannelsDataResponse,
  setPriceChannelsData: (
    value:
      | ((prevState: PriceChannelsDataResponse) => PriceChannelsDataResponse)
      | PriceChannelsDataResponse
  ) => void
): JSX.Element {
  return (
    <>
      <TextField
        id="file-selector"
        helperText="Select Price Channel Data JSON file"
        type="file"
        inputProps={{ accept: `.json` }}
        onChange={(e) => {
          const file = (e.target as HTMLInputElement).files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
              const data = JSON.parse(re.target.result as string);
              setPriceChannelsData(data);
            };
            reader.readAsText(file);
          }
        }}
      />
      <Button
        variant="contained"
        color="primary"
        startIcon={<Save />}
        onClick={() => {
          google.script.run
            .withSuccessHandler(alert)
            .withFailureHandler(alert)
            .setPriceChannelsData(priceChannelsData as any);
        }}
      >
        Upload
      </Button>
    </>
  );
}

export function MindView({ config }: { config: Config }): JSX.Element {
  const [priceChannelsData, setPriceChannelsData] =
    React.useState<PriceChannelsDataResponse>(null);

  const reload = (): void => {
    google.script.run
      .withSuccessHandler(setPriceChannelsData)
      .getPriceChannelsData();
  };

  useEffect(() => {
    reload();
    const interval = setInterval(reload, 1000 * 60);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ justifyContent: `center`, display: `flex` }}>
      {!priceChannelsData && circularProgress}
      {priceChannelsData && (
        <Stack spacing={2}>
          {list(priceChannelsData, config)}
          {uploadData(priceChannelsData, setPriceChannelsData)}
        </Stack>
      )}
    </Box>
  );
}

function list(data: PriceChannelsDataResponse, config: Config): JSX.Element {
  const candidateCoins = Object.keys(data)
    .filter((k) => {
      const ch: PriceChannelData = data[k];
      return (
        ch[Key.DURATION] > config.ChannelWindowMins &&
        ch[Key.S1] === ChannelState.TOP &&
        ch[Key.S0] === ChannelState.MIDDLE
      );
    })
    .sort((a, b) => data[b][Key.DURATION] - data[a][Key.DURATION]);

  const stateIcon = {
    [ChannelState.NONE]: growthIconMap.get(PriceMove.NEUTRAL),
    [ChannelState.TOP]: growthIconMap.get(PriceMove.UP),
    [ChannelState.BOTTOM]: growthIconMap.get(PriceMove.DOWN),
    [ChannelState.MIDDLE]: growthIconMap.get(PriceMove.NEUTRAL),
  };

  return (
    <>
      <Typography alignSelf={`center`} variant={`subtitle1`}>
        Candidates
      </Typography>
      {!candidateCoins.length && (
        <Typography alignSelf={`center`} variant={`body2`}>
          Nothing to show yet. Investment candidates will appear after some{` `}
          period of observation.
        </Typography>
      )}
      {!!candidateCoins.length && (
        <Stack>
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
                [Key.DURATION]: duration,
                [Key.MIN]: min,
                [Key.MAX]: max,
                [Key.S0]: s0,
                [Key.S1]: s1,
                [Key.S2]: s2,
              } = data[coin];
              const dataHint = `${duration}/${config.ChannelWindowMins} | ${f8(
                min
              )} | ${f8(max)}`;
              return (
                <ListItem
                  sx={{
                    padding: `0 0 6px 0`,
                  }}
                  key={i}
                  disablePadding={true}
                >
                  <ListItemAvatar sx={{ minWidth: `48px` }}>
                    #{i + 1}
                  </ListItemAvatar>
                  <ListItemText
                    sx={{ margin: `3px 0 0 0` }}
                    primary={
                      <Typography
                        sx={{ display: `flex`, alignItems: `center` }}
                      >
                        {coin + ` ✅ `}
                        {stateIcon[s2]} {stateIcon[s1]} {stateIcon[s0]}
                      </Typography>
                    }
                    secondary={dataHint}
                  />
                </ListItem>
              );
            })}
          </List>
        </Stack>
      )}
    </>
  );
}
