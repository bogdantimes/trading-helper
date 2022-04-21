import * as React from 'react';
import {useEffect} from 'react';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import {
  Button,
  createTheme,
  CssBaseline,
  Stack,
  TextField,
  ThemeProvider,
  useMediaQuery
} from "@mui/material";
import Settings from "./components/Settings";
import {Info} from "./components/Info";
import {Assets} from "./components/Assets";

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
  const handleChange = (e: React.SyntheticEvent, v: number) => setValue(v);

  const mode = useMediaQuery('(prefers-color-scheme: dark)');
  const theme = React.useMemo(() => createTheme({palette: {mode: mode ? 'dark' : 'light'}}), [mode]);

  const [coinName, setCoinName] = React.useState("BTC");

  function buy(coinName: string) {
    if (confirm(`Are you sure you want to buy ${coinName}?`)) {
      // @ts-ignore
      google.script.run.withSuccessHandler(alert).buyCoin(coinName);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline/>
      <Box sx={{width: '100%'}}>
        <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
          <Tabs value={value} onChange={handleChange}>
            <Tab label="Assets" {...a11yProps(0)} />
            <Tab label="Trading" {...a11yProps(1)} />
            <Tab label="Settings" {...a11yProps(2)} />
            <Tab label="Info" {...a11yProps(3)} />
          </Tabs>
        </Box>
        <TabPanel value={value} index={0}>
          <Assets/>
        </TabPanel>
        <TabPanel value={value} index={1}>
          <Stack direction={"row"} spacing={2}>
            <TextField label="Coin name" value={coinName}
              onChange={(e) => setCoinName(e.target.value)}/>
            <Button variant="contained" onClick={() => buy(coinName)}>Buy</Button>
          </Stack>
        </TabPanel>
        <TabPanel value={value} index={2}>
          <Settings/>
        </TabPanel>
        <TabPanel value={value} index={3}>
          <Info/>
        </TabPanel>
      </Box>
    </ThemeProvider>
  );
}
