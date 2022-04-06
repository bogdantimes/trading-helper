import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Trade from "./components/Trade";
import {
  Button,
  createTheme,
  CssBaseline,
  FormGroup,
  TextField,
  ThemeProvider,
  useMediaQuery
} from "@mui/material";
import {useEffect} from "react";
import {Config} from "../apps-script/Store";
import Settings from "./components/Settings";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const {children, value, index, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{p: 3}}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    'aria-controls': `simple-tabpanel-${index}`,
  };
}

export default function App() {
  const [value, setValue] = React.useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? 'dark' : 'light',
        },
      }),
    [prefersDarkMode],
  );

  const [trades, setTrades] = React.useState({});
  useEffect(() => {
    // @ts-ignore
    google.script.run.withSuccessHandler(setTrades).getTrades();
  }, [])

  const [config, setConfig] = React.useState({});
  useEffect(() => {
    // @ts-ignore
    google.script.run.withSuccessHandler(setConfig).getConfig();
  }, [])

  function saveConfig(cfg: Config) {
    // @ts-ignore
    google.script.run.setConfig({...config, ...cfg});
    setConfig({...config, ...cfg});
  }

  const [coinName, setCoinName] = React.useState("BTC");

  function buy(coinName: string) {
    // @ts-ignore
    google.script.run.withSuccessHandler(alert).buyCoin(coinName);
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline/>
      <Box sx={{width: '100%'}}>
        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
          <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
            <Tab label="Assets" {...a11yProps(0)} />
            <Tab label="Trading" {...a11yProps(1)} />
            <Tab label="Settings" {...a11yProps(2)} />
          </Tabs>
        </Box>
        <TabPanel value={value} index={0}>
          {Object.keys(trades).map((key, index) =>
            <Box sx={{display: 'inline-flex', margin: '10px'}}>
              <Trade key={index} name={key} data={trades[key]} config={config}/>
            </Box>
          )}
        </TabPanel>
        <TabPanel value={value} index={1}>
          <FormGroup>
            <TextField
              label="Coin name"
              value={coinName}
              onChange={(e) => setCoinName(e.target.value)}/>
            <Button onClick={() => buy(coinName)}>Buy</Button>
          </FormGroup>
        </TabPanel>
        <TabPanel value={value} index={2}>
          <Settings config={config} onSave={saveConfig}/>
        </TabPanel>
      </Box>
    </ThemeProvider>
  );
}
