// TradeTitle components extract the card content from the TradeMemo
// which includes the coin name and the edit and delete buttons.
import {TradeMemo} from "../../apps-script/TradeMemo";
import {IconButton, useTheme} from "@mui/material";
import * as React from "react";
import {useState} from "react";
import {Delete, Edit, KeyboardArrowUp, KeyboardDoubleArrowUp} from "@mui/icons-material";
import Typography from "@mui/material/Typography";

export function TradeTitle({tradeMemo, onEdit, onDelete}: {
  tradeMemo: TradeMemo,
  onEdit: () => void,
  onDelete: () => void,
}) {

  const theme = useTheme();
  const [editHover, setEditHover] = useState(false);
  const [deleteHover, setDeleteHover] = useState(false);

  let progressIcon = null;
  const tailGrowthIndex = tradeMemo.getConsecutiveGrowthIndex(tradeMemo.prices.slice(-3));
  if (tailGrowthIndex === 1) {
    progressIcon = <KeyboardArrowUp htmlColor={"green"}/>
  } else if (tailGrowthIndex === 2) {
    progressIcon = <KeyboardDoubleArrowUp htmlColor={"green"}/>
  }

  const editIcon = <IconButton onClick={onEdit}
                               onMouseEnter={() => setEditHover(true)}
                               onMouseLeave={() => setEditHover(false)}
                               style={{
                                 marginLeft: "auto",
                                 color: editHover ? theme.palette.primary.main : theme.palette.action.disabled
                               }}><Edit/></IconButton>;
  const deleteIcon = <IconButton onClick={onDelete}
                                 onMouseEnter={() => setDeleteHover(true)}
                                 onMouseLeave={() => setDeleteHover(false)}
                                 style={{
                                   color: deleteHover ? theme.palette.error.main : theme.palette.action.disabled
                                 }}><Delete/></IconButton>;

  return (
    <Typography sx={{display: 'flex', alignItems: 'center'}} gutterBottom variant="h5"
                component="div">{tradeMemo.getCoinName()} {progressIcon}{editIcon}{deleteIcon}</Typography>
  )
}
