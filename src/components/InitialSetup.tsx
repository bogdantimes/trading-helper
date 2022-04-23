import * as React from 'react';
import {useState} from "react";
import StartIcon from '@mui/icons-material/Start';
import {Config} from "../../apps-script/Store";
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
} from "@mui/material";
import {circularProgress} from "./Common";
import Typography from "@mui/material/Typography";
import {InitialSetupParams} from "../../apps-script/api";
import {gsr} from "../App";

export function InitialSetup({config, onConnect}: { config: Config, onConnect: () => void }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const [params, setParams] = useState<InitialSetupParams>({
    dbURL: '',
    binanceAPIKey: config && config.KEY,
    binanceSecretKey: config && config.SECRET,
  });

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setParams({...params, [e.target.name]: e.target.value});
  }

  function onClickConnect() {
    setIsConnecting(true);
    gsr.withSuccessHandler(() => {
      setIsConnecting(false);
      onConnect();
    }).withFailureHandler(resp => {
      setIsConnecting(false);
      setError(resp.toString());
    }).initialSetup(params);
  }

  return (
    <Stack spacing={2} sx={{
      margin: '10px',
      alignItems: 'center',
      justifyContent: 'center',
      '& .MuiTextField-root': {width: '70ch'}
    }}>
      <StartIcon sx={{fontSize: '100px', color: 'primary'}}/>
      <Typography variant="h5" component="h3">
        Welcome to the Trading Helper!
      </Typography>
      <Typography variant="body1" component="p">
        Before you begin, you need to connect your database and Binance API keys.
      </Typography>
      <TextField value={params.dbURL} label={"Firebase Database URL"}
                 onChange={onChange} name="dbURL"/>
      <TextField value={params.binanceAPIKey} label={"Binance API Key"}
                 onChange={onChange} name="binanceAPIKey"/>
      <TextField value={params.binanceSecretKey} label={"Binance Secret Key"}
                 onChange={onChange} name="binanceSecretKey"/>
      <Stack direction={"row"}>
        <Box sx={{position: 'relative'}}>
          <Button variant="contained" color="primary" onClick={onClickConnect} disabled={isConnecting}>Connect</Button>
          {isConnecting && circularProgress}
        </Box>
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}
