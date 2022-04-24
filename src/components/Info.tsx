import * as React from "react";
import {useEffect} from "react";
import {DataGrid, GridColDef} from '@mui/x-data-grid';
import {Stats} from "../../apps-script/Statistics";

export function Info() {
  const [stats, setStats] = React.useState<Stats>({DailyProfit: {}, TotalProfit: NaN});
  useEffect(() => {
    // @ts-ignore
    google.script.run.withSuccessHandler(setStats).getStatistics();
  }, [])

  const columns: GridColDef[] = [
    {field: 'id', headerName: 'ID', minWidth: 70},
    {field: 'timeFrame', headerName: 'Time-Frame', flex: 0.5},
    {field: 'profit', headerName: 'Profit', flex: 0.5},
  ];

  const rows = [];

  rows.push({id: 1, timeFrame: 'Total', profit: stats.TotalProfit});
  Object.keys(stats.DailyProfit)
    .sort((a, b) => new Date(a) < new Date(b) ? 1 : -1)
    .forEach((d, i) => {
      rows.push({id: i + 2, timeFrame: d, profit: stats.DailyProfit[d]});
    });

  return (
    <div style={{height: 400, width: '100%'}}>
      <DataGrid
        rows={rows}
        columns={columns}
      />
    </div>
  );
}
