import * as React from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Trade from "./components/Trade";
import {createTheme, CssBaseline, ThemeProvider, useMediaQuery} from "@mui/material";
import {useEffect} from "react";

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

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline/>
      <Box sx={{width: '100%'}}>
        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
          <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
            <Tab label="Trades" {...a11yProps(0)} />
            <Tab label="Config" {...a11yProps(1)} />
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
          Item Two
        </TabPanel>
      </Box>
    </ThemeProvider>
  );
}
