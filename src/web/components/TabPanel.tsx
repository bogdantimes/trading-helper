import Box from "@mui/material/Box";
import * as React from "react";
import { Container } from "@mui/material";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

export function TabPanel(props: TabPanelProps): JSX.Element {
  const { children, value, index, ...other } = props;

  return (
    <Container
      disableGutters={true}
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box display="flex" justifyContent="center" sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </Container>
  );
}
