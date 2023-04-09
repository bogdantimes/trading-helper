import React from "react";
import {
  Box,
  Card,
  CardActions,
  CardContent,
  IconButton,
  Typography,
} from "@mui/material";
import { ArrowDropDown } from "@mui/icons-material";
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

const CryptoCard = ({ cfg, tm }) => {
  const handleHold = () => {
    // Implement HOLD functionality
  };

  const handleDelete = () => {
    // Implement DELETE functionality
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
            <Typography variant="h6">BTC</Typography>
            <Box display="flex" alignItems="center">
              <Typography variant="body1" color="error">
                +3.78%
              </Typography>
              <ArrowDropDown color="error" />
            </Box>
          </Box>
          <Typography variant="body2">Paid: 122 USDT</Typography>
          <Typography variant="body2">Current: ~137 USDT</Typography>
        </CardContent>
        <CardActions disableSpacing>
          <IconButton onClick={handleHold}>
            <Typography variant="button">HOLD</Typography>
          </IconButton>
          <IconButton onClick={handleDelete}>
            <Typography variant="button">DELETE</Typography>
          </IconButton>
        </CardActions>
      </Card>
    </ThemeProvider>
  );
};

export default CryptoCard;
