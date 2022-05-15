import * as React from "react";
import {useEffect} from "react";
import {Stats} from "../../apps-script/Statistics";
import {Box, ListItem, ListItemAvatar, ListItemText} from "@mui/material";
import {FixedSizeList} from 'react-window';

export function Info() {
  const [stats, setStats] = React.useState<Stats>({DailyProfit: {}, TotalProfit: NaN});

  useEffect(() => {
    google.script.run.withSuccessHandler(setStats).getStatistics();
  }, [])

  const rows = [];

  rows.push({id: 1, timeFrame: 'Total', profit: stats.TotalProfit});
  Object.keys(stats.DailyProfit)
    .sort((a, b) => new Date(a) < new Date(b) ? 1 : -1)
    .forEach((d, i) => {
      rows.push({id: i + 2, timeFrame: d, profit: stats.DailyProfit[d]});
    });

  return (
    <Box sx={{justifyContent: 'center', display: 'flex'}}>
      <FixedSizeList
        width={300}
        height={400}
        itemSize={46}
        itemCount={rows.length}
        overscanCount={5}
      >
        {({index, style}) =>
          <ListItem style={style} key={index} component="div" disablePadding>
            <ListItemAvatar>#{rows[index].id}</ListItemAvatar>
            <ListItemText primary={rows[index].profit} secondary={rows[index].timeFrame}/>
          </ListItem>
        }
      </FixedSizeList>
    </Box>
  );
}
