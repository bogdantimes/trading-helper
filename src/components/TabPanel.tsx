import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import * as React from 'react'
import { Container, Grid } from '@mui/material'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

export function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <Container
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Grid container>
          <Grid item xs={12}>
            <Box sx={{ p: 3 }}>{children}</Box>
          </Grid>
        </Grid>
      )}
    </Container>
  )
}
