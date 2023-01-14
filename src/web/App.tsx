import * as React from "react";
import { useEffect } from "react";
import { useDoubleTap } from "use-double-tap";
import InfoIcon from "@mui/icons-material/Info";
import HomeIcon from "@mui/icons-material/Home";
import SettingsIcon from "@mui/icons-material/Settings";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import {
  Alert,
  createTheme,
  CssBaseline,
  Dialog,
  LinearProgress,
  ThemeProvider,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Settings } from "./components/Settings";
import { Info } from "./components/Info";
import { Home } from "./components/Home";
import { TabPanel } from "./components/TabPanel";
import { InitialSetup } from "./components/InitialSetup";
import { AppState } from "../lib";
import Terminal, { ColorMode } from "react-terminal-ui";
import { DefaultConfig } from "../gas/dao/Config";

function a11yProps(index: number): { id: string; [`aria-controls`]: string } {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

export default function App(): JSX.Element {
  const mode = useMediaQuery(`(prefers-color-scheme: dark)`);
  const theme = React.useMemo(
    () => createTheme({ palette: { mode: mode ? `dark` : `light` } }),
    [mode]
  );

  const [state, setState] = React.useState<AppState>({
    assets: [],
    candidates: {},
    config: DefaultConfig(),
    firebaseURL: ``,
    info: { TotalProfit: 0, TotalWithdrawals: 0, DailyProfit: {} },
  });
  const [initialSetup, setInitialSetup] = React.useState(true);
  const [fetchingData, setFetchingData] = React.useState(true);
  const [fetchDataError, setFetchDataError] = React.useState(``);
  const [deletingAsset, setDeletingAsset] = React.useState(false);

  useEffect(initialFetch, []);
  useEffect(() => {
    // re-fetch config from time to time just to synchronize it in case changes
    // were made in different browser tabs, etc.
    const interval = setInterval(() => !initialSetup && reFetchState(), 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [initialSetup]);

  function initialFetch(): void {
    setFetchingData(true);
    google.script.run
      .withSuccessHandler(handleState)
      .withFailureHandler((resp) => {
        setFetchingData(false);
        setInitialSetup(true);
        setFetchDataError(resp.message);
      })
      .getState();
  }

  function handleState(state: AppState): void {
    const { ViewOnly, KEY, SECRET } = state.config;
    setFetchingData(false);
    setFetchDataError(``);
    setInitialSetup(!ViewOnly && !(KEY && SECRET));
    setState(state);
  }

  function reFetchState(): void {
    if (tab === TabId.Settings) {
      // do not re-fetch state when on Settings tab
      return;
    }
    google.script.run
      .withSuccessHandler(handleState)
      .withFailureHandler((resp) => setFetchDataError(resp.message))
      .getState();
  }

  function onAssetDelete(coinName: string, noConfirm = false): void {
    if (noConfirm || confirm(`Are you sure you want to remove ${coinName}?`)) {
      setDeletingAsset(true);
      google.script.run
        .withSuccessHandler(() => {
          setState({
            ...state,
            assets: state.assets.filter(
              (a) => a.tradeResult.symbol.quantityAsset !== coinName
            ),
          });
          setDeletingAsset(false);
        })
        .withFailureHandler((err) => {
          setDeletingAsset(false);
          alert(err);
        })
        .dropCoin(coinName);
    }
  }

  const [terminalOpen, setTerminalOpen] = React.useState(false);
  const [terminalOutput, setTerminalOutput] = React.useState(``);
  const openTerminal = useDoubleTap((event) => {
    event.preventDefault();
    setTerminalOpen(true);
  });

  const [tab, setTab] = React.useState(0);
  const changeTab = (e: React.SyntheticEvent, v: number): void => {
    setTab((prevState) => {
      if (prevState !== TabId.Settings && v === TabId.Settings) {
        // Reload state when opening Settings
        reFetchState();
      }
      return v;
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {fetchingData && (
        <Box sx={{ width: `100%` }}>
          <LinearProgress />
        </Box>
      )}
      {fetchDataError && (
        <Alert severity="error">
          <Typography variant="caption">{fetchDataError}</Typography>
          <Typography variant="caption">
            {` `}Please check your network connection and that Google Apps
            Script application is deployed and try again.
          </Typography>
        </Alert>
      )}
      {!fetchingData && initialSetup && (
        <InitialSetup
          firebaseURL={state.firebaseURL}
          config={state.config}
          onConnect={initialFetch}
        />
      )}
      {!fetchingData && !initialSetup && (
        <Box sx={{ width: `100%` }}>
          <Box sx={{ borderBottom: 1, borderColor: `divider` }}>
            <Tabs value={tab} onChange={changeTab} centered>
              <Tab {...a11yProps(TabId.Home)} icon={<HomeIcon />} />
              <Tab
                icon={<InfoIcon />}
                {...a11yProps(TabId.Info)}
                {...openTerminal}
              />
              <Tab {...a11yProps(TabId.Settings)} icon={<SettingsIcon />} />
            </Tabs>
          </Box>
          <TabPanel value={tab} index={TabId.Home}>
            <Home
              state={state}
              onAssetDelete={deletingAsset ? undefined : onAssetDelete}
            />
          </TabPanel>
          <TabPanel value={tab} index={TabId.Info}>
            <Info stats={state.info} />
          </TabPanel>
          <TabPanel value={tab} index={TabId.Settings}>
            <Settings
              config={state.config}
              setConfig={(config) => handleState({ ...state, config })}
              firebaseURL={state.firebaseURL}
            />
          </TabPanel>
        </Box>
      )}
      <Dialog open={terminalOpen} onClose={() => setTerminalOpen(false)}>
        <Box
          width={600}
          height={400}
          sx={{ [`.react-terminal`]: { height: `290px` } }}
        >
          <Terminal
            name="API"
            colorMode={
              theme.palette.mode === `dark` ? ColorMode.Dark : ColorMode.Light
            }
            onInput={(terminalInput) => {
              // parse terminal input: <cmd> <arg1> <arg2> ...
              const [cmd, ...args] = terminalInput.split(` `);
              // JSON parse the args
              const parsedArgs = args.map((arg) => JSON.parse(arg));
              // call the function
              google.script.run
                .withSuccessHandler((resp) => {
                  setTerminalOutput(JSON.stringify(resp, null, 2));
                })
                .withFailureHandler((resp) => {
                  setTerminalOutput(resp.message);
                })
                [cmd](...parsedArgs);
            }}
          >
            {terminalOutput}
          </Terminal>
        </Box>
      </Dialog>
    </ThemeProvider>
  );
}

enum TabId {
  Home,
  Info,
  Settings,
}
