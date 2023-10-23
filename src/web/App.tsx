import * as React from "react";
import { useEffect } from "react";
import InfoIcon from "@mui/icons-material/Info";
import TerminalIcon from "@mui/icons-material/Terminal";
import HomeIcon from "@mui/icons-material/Home";
import SettingsIcon from "@mui/icons-material/Settings";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";
import { ErrorBoundary } from "react-error-boundary";
import {
  Alert,
  Card,
  Container,
  createTheme,
  CssBaseline,
  Fab,
  LinearProgress,
  ThemeProvider,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Settings } from "./components/Settings";
import { BalanceHistory } from "./components/BalanceHistory";
import { Home } from "./components/Home";
import { TabPanel } from "./components/TabPanel";
import { InitialSetup } from "./components/InitialSetup";
import { type AppState } from "../lib";
import { DefaultConfig } from "../gas/dao/Config";
import { ScriptApp } from "./components/Common";
import useWebSocket from "./useWebSocket";
import { APIConsole } from "./components/APIConsole";

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
    [mode],
  );

  const [state, setState] = React.useState<AppState>({
    assets: [],
    candidates: {
      selected: {},
      other: {},
      marketInfo: { averageDemand: 0, accuracy: 0, strength: 0 },
    },
    config: DefaultConfig(),
    firebaseURL: ``,
    info: { TotalProfit: 0, TotalWithdrawals: 0, DailyProfit: {} },
  });
  const [initialSetup, setInitialSetup] = React.useState(true);
  const [fetchingData, setFetchingData] = React.useState(true);
  const [fetchDataError, setFetchDataError] = React.useState(``);

  useEffect(initialFetch, []);
  useEffect(() => {
    // re-fetch config from time to time just to synchronize it in case changes
    // were made in different browser tabs, etc.
    const interval = setInterval(() => {
      !initialSetup && reFetchState();
    }, 60000); // 60 seconds
    return () => {
      clearInterval(interval);
    };
  }, [initialSetup]);

  const data = process.env.WEBDEV ? useWebSocket(`ws://localhost:3000`) : null;

  useEffect(() => {
    if (data) {
      handleState(data);
    }
  }, [data]);

  function initialFetch(): void {
    setFetchingData(true);
    ScriptApp?.withSuccessHandler(handleState)
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

  function reFetchState(cb?: () => void): void {
    if (tab === TabId.Settings) {
      // do not re-fetch state when on Settings tab
      return;
    }
    ScriptApp?.withSuccessHandler((state: AppState) => {
      handleState(state);
      cb?.();
    })
      .withFailureHandler((resp) => {
        setFetchDataError(resp.message);
      })
      .getState();
  }

  const [terminalOpen, setTerminalOpen] = React.useState(false);

  const [tab, setTab] = React.useState(0);
  const changeTab = (e: React.SyntheticEvent, v: number): void => {
    if (!TabId[v]) return;
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
      <ErrorBoundary FallbackComponent={Fallback}>
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
          <Container sx={{ pt: 3 }}>
            <Card sx={{ p: 3, boxShadow: 2, borderRadius: `1rem` }}>
              <InitialSetup
                firebaseURL={state.firebaseURL}
                config={state.config}
                onConnect={initialFetch}
              />
            </Card>
          </Container>
        )}
        {!fetchingData && !initialSetup && (
          <Box sx={{ width: `100%` }}>
            <Box sx={{ borderBottom: 1, borderColor: `divider` }}>
              <Tabs value={tab} onChange={changeTab} centered>
                <Tab {...a11yProps(TabId.Home)} icon={<HomeIcon />} />
                <Tab icon={<InfoIcon />} {...a11yProps(TabId.Info)} />
                <Tab {...a11yProps(TabId.Settings)} icon={<SettingsIcon />} />
              </Tabs>
            </Box>
            <TabPanel value={tab} index={TabId.Home} onChange={changeTab}>
              <Home state={state} />
            </TabPanel>
            <TabPanel value={tab} index={TabId.Info} onChange={changeTab}>
              <BalanceHistory stats={state.info} />
            </TabPanel>
            <TabPanel value={tab} index={TabId.Settings} onChange={changeTab}>
              <Settings
                config={state.config}
                setConfig={(config) => {
                  handleState({ ...state, config });
                }}
                firebaseURL={state.firebaseURL}
              />
            </TabPanel>
          </Box>
        )}
      </ErrorBoundary>

      <Fab
        color="primary"
        aria-label="open terminal"
        onClick={() => {
          setTerminalOpen(true);
        }}
        sx={{
          position: `fixed`,
          bottom: (theme) => theme.spacing(2),
          right: (theme) => theme.spacing(2),
        }}
      >
        <TerminalIcon />
      </Fab>
      <APIConsole
        terminalOpen={terminalOpen}
        setTerminalOpen={setTerminalOpen}
        reFetchState={reFetchState}
      />
    </ThemeProvider>
  );
}

function Fallback({ error }: { error: Error }): JSX.Element {
  return (
    <Alert severity={`error`}>
      Something went wrong:
      <pre>{error.message}</pre>
      <pre>{error.stack}</pre>
    </Alert>
  );
}

enum TabId {
  Home,
  Info,
  Settings,
}
