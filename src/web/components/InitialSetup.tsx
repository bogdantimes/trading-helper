import * as React from "react"
import { useState } from "react"
import { Alert, Box, Button, Stack, TextField, Typography } from "@mui/material"
import { circularProgress } from "./Common"
import { Config, InitialSetupParams } from "trading-helper-lib"

enum Step {
  DbConnect,
  BinanceConnect,
}

export function InitialSetup({ config, onConnect }: { config: Config; onConnect: () => void }) {
  const [step, setStep] = useState(Step.DbConnect)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState(``)

  const [params, setParams] = useState<InitialSetupParams>({
    dbURL: ``,
    binanceAPIKey: config?.KEY,
    binanceSecretKey: config?.SECRET,
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

  const welcomeTitle = `Welcome to the Trading Helper!`
  const welcomeTxt = `You can connect Firebase Realtime Database as a permanent storage now or do this later in the settings. 
 Firebase allows to upgrade the tool and maintain your data when a new version of Trading Helper is available.`

  const step2Title = `Almost done!`
  const step2Txt = `Setup API key and secret to connect Binance.`

  return (
    <Stack
      spacing={2}
      sx={{
        margin: `10px`,
        alignItems: `center`,
        justifyContent: `center`,
        "& .MuiTextField-root": { width: `90%`, maxWidth: `700px` },
        "& .MuiTypography-root": { width: `90%`, maxWidth: `700px` },
      }}
    >
      <img
        width={200}
        src="https://user-images.githubusercontent.com/7527778/167810306-0b882d1b-64b0-4fab-b647-9c3ef01e46b4.png"
        alt="Trading Helper logo"
      />
      <Typography variant="h5" component="h3">
        {step === Step.DbConnect ? welcomeTitle : step2Title}
      </Typography>
      <Typography variant="body1" component="p">
        {step === Step.DbConnect ? welcomeTxt : step2Txt}
      </Typography>
      {step === Step.DbConnect && (
        <TextField
          value={params.dbURL}
          label={`Firebase Database URL`}
          onChange={onChange}
          name="dbURL"
        />
      )}
      {step === Step.BinanceConnect && (
        <TextField
          type={`password`}
          value={params.binanceAPIKey}
          label={`Binance API Key`}
          onChange={onChange}
          name="binanceAPIKey"
        />
      )}
      {step === Step.BinanceConnect && (
        <TextField
          type={`password`}
          value={params.binanceSecretKey}
          label={`Binance Secret Key`}
          onChange={onChange}
          name="binanceSecretKey"
        />
      )}
      <Stack direction={`row`} spacing={2}>
        {step === Step.DbConnect && (
          <Button
            color="primary"
            onClick={() => {
              setParams({ ...params, dbURL: `` })
              setStep(Step.BinanceConnect)
            }}
          >
            Skip
          </Button>
        )}
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
      {error && <Alert severity="error">{error.toString()}</Alert>}
    </Stack>
  )
}
