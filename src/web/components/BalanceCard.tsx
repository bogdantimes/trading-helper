import React, { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Popover,
  Button,
} from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";

const theme = createTheme({
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: `1rem`,
          width: `100%`,
          textAlign: `left`,
          boxShadow: `0 4px 6px rgba(0,0,0,0.1)`,
        },
      },
    },
  },
});

const InAssetsPopup = ({ anchorEl, handleClose }): JSX.Element => (
  <Popover
    open={Boolean(anchorEl)}
    anchorEl={anchorEl}
    onClose={handleClose}
    anchorOrigin={{
      vertical: `bottom`,
      horizontal: `left`,
    }}
    transformOrigin={{
      vertical: `top`,
      horizontal: `left`,
    }}
  >
    <Box p={2}>
      <Typography variant="h6" gutterBottom>
        ! Sell All !
      </Typography>
      <Typography variant="body2">Warning...</Typography>
    </Box>
  </Popover>
);

const PLPopup = ({ anchorEl, handleClose }): JSX.Element => (
  <Popover
    open={Boolean(anchorEl)}
    anchorEl={anchorEl}
    onClose={handleClose}
    anchorOrigin={{
      vertical: `bottom`,
      horizontal: `left`,
    }}
    transformOrigin={{
      vertical: `top`,
      horizontal: `left`,
    }}
  >
    <Box p={2}>
      <Typography variant="h6" gutterBottom>
        Total P/L: 78 USDT
      </Typography>
      <Typography variant="body2">1 Mar 2022: 3 USDT</Typography>
      <Box mt={2}>
        <Button variant="contained" onClick={handleClose}>
          Reset
        </Button>
      </Box>
    </Box>
  </Popover>
);

const BalanceCard = (): JSX.Element => {
  const [assetsAnchorEl, setAssetsAnchorEl] = useState(null);
  const [plAnchorEl, setPlAnchorEl] = useState(null);

  const handleAssetsClick = (event): void => {
    setAssetsAnchorEl(event.currentTarget);
  };

  const handleAssetsClose = (): void => {
    setAssetsAnchorEl(null);
  };

  const handlePLClick = (event): void => {
    setPlAnchorEl(event.currentTarget);
  };

  const handlePLClose = (): void => {
    setPlAnchorEl(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <Card>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="body1">Free</Typography>
            <Typography
              variant="body1"
              onClick={handleAssetsClick}
              sx={{ cursor: `pointer` }}
            >
              In Assets
            </Typography>
            <Typography variant="body1">|</Typography>
            <Typography
              variant="body1"
              onClick={handlePLClick}
              sx={{ cursor: `pointer` }}
            >
              P/L~
            </Typography>
          </Box>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="body2">23 USDT</Typography>
            <Typography variant="body2">~ 137 USDT</Typography>
            <Typography variant="body2" />
            <Typography variant="body2">+14.7%</Typography>
          </Box>
        </CardContent>
      </Card>
      <InAssetsPopup
        anchorEl={assetsAnchorEl}
        handleClose={handleAssetsClose}
      />
      <PLPopup anchorEl={plAnchorEl} handleClose={handlePLClose} />
    </ThemeProvider>
  );
};

export default BalanceCard;
