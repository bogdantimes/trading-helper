import * as React from "react"
import { useState } from "react"
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material"
import { circularProgress } from "./Common"
import { Config, InitialSetupParams } from "trading-helper-lib"

export function InitialSetup({ config, onConnect }: { config: Config; onConnect: () => void }) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState(``)

  const [params, setParams] = useState<InitialSetupParams>({
    dbURL: ``,
    binanceAPIKey: config && config.KEY,
    binanceSecretKey: config && config.SECRET,
  })

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setParams({ ...params, [e.target.name]: e.target.value })
  }

  function onClickConnect() {
    setIsConnecting(true)
    google.script.run
      .withSuccessHandler(() => {
        setIsConnecting(false)
        onConnect()
      })
      .withFailureHandler((resp) => {
        setIsConnecting(false)
        setError(resp.toString())
      })
      .initialSetup(params as any)
  }

  const welcomeMsg = `Welcome to the Trading Helper!`
  const welcomeDescr = `Before you begin, you need to connect your database.`
  const step2Header = `Almost done!`
  const step2descr = `Setup API key and secret to connect Binance.`
  return (
    <Stack
      spacing={2}
      sx={{
        margin: `10px`,
        alignItems: `center`,
        justifyContent: `center`,
        "& .MuiTextField-root": { width: `70ch` },
      }}
    >
      <img
        width={200}
        src="https://user-images.githubusercontent.com/7527778/167810306-0b882d1b-64b0-4fab-b647-9c3ef01e46b4.png"
        alt="Trading Helper logo"
      />
      <Typography variant="h5" component="h3">
        {!config ? welcomeMsg : step2Header}
      </Typography>
      <Typography variant="body1" component="p">
        {!config ? welcomeDescr : step2descr}
      </Typography>
      {!config && (
        <TextField
          value={params.dbURL}
          label={`Firebase Database URL`}
          onChange={onChange}
          name="dbURL"
        />
      )}
      {config && (
        <TextField
          type={`password`}
          value={params.binanceAPIKey}
          label={`Binance API Key`}
          onChange={onChange}
          name="binanceAPIKey"
        />
      )}
      {config && (
        <TextField
          type={`password`}
          value={params.binanceSecretKey}
          label={`Binance Secret Key`}
          onChange={onChange}
          name="binanceSecretKey"
        />
      )}
      <Stack direction={`row`}>
        <Box sx={{ position: `relative` }}>
          <Button
            variant="contained"
            color="primary"
            onClick={onClickConnect}
            disabled={isConnecting}
          >
            Connect
          </Button>
          {isConnecting && circularProgress}
        </Box>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  )
}
