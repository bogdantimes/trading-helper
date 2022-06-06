import * as React from "react"
import { useEffect } from "react"
import Tabs from "@mui/material/Tabs"
import Tab from "@mui/material/Tab"
import Box from "@mui/material/Box"
import {
  Alert,
  createTheme,
  CssBaseline,
  LinearProgress,
  ThemeProvider,
  Typography,
  useMediaQuery,
} from "@mui/material"
import { Settings } from "./components/Settings"
import { Info } from "./components/Info"
import { Assets } from "./components/Assets"
import { TabPanel } from "./components/TabPanel"
import { InitialSetup } from "./components/InitialSetup"
import { Scores } from "./components/Scores"
import { Config, Profile } from "trading-helper-lib"
import { ProfilePickerDialog } from "./components/ProfilePickerDialog"

function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  }
}

export default function App() {
  const [value, setValue] = React.useState(0)
  const handleChange = (e: React.SyntheticEvent, v: number) => setValue(v)

  const mode = useMediaQuery(`(prefers-color-scheme: dark)`)
  const theme = React.useMemo(
    () => createTheme({ palette: { mode: mode ? `dark` : `light` } }),
    [mode],
  )

  const [config, setConfig] = React.useState(null)

  const [initialSetup, setInitialSetup] = React.useState(true)
  const [fetchingData, setFetchingData] = React.useState(true)
  const [fetchDataError, setFetchDataError] = React.useState(null)
  const [profiles, setProfiles] = React.useState(null)
  const [selectedProfile, setSelectedProfile] = React.useState<Profile>(null)

  // Step 1
  useEffect(fetchProfiles, [])

  function fetchProfiles() {
    google.script.run
      .withSuccessHandler((response) => {
        setProfiles(response)
        if (response && Object.keys(response).length == 1 && response.default) {
          setSelectedProfile(response.default)
        }
      })
      .withFailureHandler((resp) => {
        setFetchDataError(resp.toString())
      })
      .getProfiles()
  }

  // Step 2
  useEffect(() => selectedProfile && initialFetch(), [selectedProfile])

  function initialFetch() {
    setFetchingData(true)
    google.script.run
      .withSuccessHandler(handleConfig)
      .withFailureHandler((resp) => {
        setFetchingData(false)
        setInitialSetup(true)
        setFetchDataError(resp.toString())
      })
      .getConfig(selectedProfile as any)
  }

  function handleConfig(cfg: Config) {
    setConfig(cfg)
    setFetchingData(false)
    setFetchDataError(null)
    if (!cfg || !cfg.KEY || !cfg.SECRET) {
      setInitialSetup(true)
    } else {
      setInitialSetup(false)
    }
  }

  useEffect(() => {
    // re-fetch config from time to time just to synchronize it in case changes
    // were made in different browser tabs, etc.
    const interval = setInterval(() => selectedProfile && reFetchData(), 60000) // 60 seconds
    return () => clearInterval(interval)
  }, [selectedProfile])

  function reFetchData() {
    google.script.run
      .withSuccessHandler(handleConfig)
      .withFailureHandler((resp) => setFetchDataError(resp.toString()))
      .getConfig(selectedProfile as any)
  }

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
            {` `}Please check your network connection and that Google Apps Script application is
            deployed and try again.
          </Typography>
        </Alert>
      )}
      {profiles && !selectedProfile && (
        <ProfilePickerDialog profiles={profiles} onSelect={setSelectedProfile} />
      )}
      {!fetchingData && initialSetup && <InitialSetup config={config} onConnect={initialFetch} />}
      {!fetchingData && !initialSetup && (
        <Box sx={{ width: `100%` }}>
          <Box sx={{ borderBottom: 1, borderColor: `divider` }}>
            <Tabs value={value} onChange={handleChange} centered>
              <Tab label="Assets" {...a11yProps(0)} />
              <Tab label="Scores" {...a11yProps(1)} />
              <Tab sx={{ minWidth: `50px` }} label="Info" {...a11yProps(2)} />
              <Tab label="Settings" {...a11yProps(3)} />
            </Tabs>
          </Box>
          <TabPanel value={value} index={0}>
            <Assets config={config} />
          </TabPanel>
          <TabPanel value={value} index={1}>
            <Scores config={config} />
          </TabPanel>
          <TabPanel value={value} index={2}>
            <Info config={config} />
          </TabPanel>
          <TabPanel value={value} index={3}>
            <Settings config={config} setConfig={setConfig} />
          </TabPanel>
        </Box>
      )}
    </ThemeProvider>
  )
}
