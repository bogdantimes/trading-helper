import {TradeMemo, TradeState} from "../../apps-script/TradeMemo";
import {IconButton, useTheme} from "@mui/material";
import * as React from "react";
import {useState} from "react";
import {
  Delete,
  Edit,
  KeyboardArrowDown,
  KeyboardArrowUp,
  KeyboardDoubleArrowDown,
  KeyboardDoubleArrowUp
} from "@mui/icons-material";
import Typography from "@mui/material/Typography";

const growthIconMap = new Map<number, JSX.Element>();
growthIconMap.set(-2, <KeyboardDoubleArrowDown htmlColor={"red"}/>);
growthIconMap.set(-1, <KeyboardArrowDown htmlColor={"red"}/>);
growthIconMap.set(1, <KeyboardArrowUp htmlColor={"green"}/>);
growthIconMap.set(2, <KeyboardDoubleArrowUp htmlColor={"green"}/>);

export function TradeTitle({tradeMemo, onEdit, onDelete}: {
  tradeMemo: TradeMemo,
  onEdit: () => void,
  onDelete: () => void,
}) {

  const theme = useTheme();
  const [editHover, setEditHover] = useState(false);
  const [deleteHover, setDeleteHover] = useState(false);

  const growthIndex = tradeMemo.getGrowthIndex(tradeMemo.prices);

  // normalize growth index to be in range -2 ... 2
  const ranges = 4;
  const normalIndex = Math.max(-2, Math.min(2,
    +((growthIndex / (tradeMemo.prices.length - 1)) * ranges).toFixed(0)
  ))

  const growthIcon = growthIconMap.get(normalIndex);

  const editColor = editHover ? theme.palette.action.active : theme.palette.action.disabled;
  const editIcon = tradeMemo.stateIs(TradeState.BOUGHT) &&
    <IconButton onClick={onEdit} sx={{color: editColor}}
                onMouseEnter={() => setEditHover(true)}
                onMouseLeave={() => setEditHover(false)}><Edit/></IconButton>;
  const deleteColor = deleteHover ? theme.palette.action.active : theme.palette.action.disabled
  const deleteIcon = <IconButton onClick={onDelete} sx={{color: deleteColor}}
                                 onMouseEnter={() => setDeleteHover(true)}
                                 onMouseLeave={() => setDeleteHover(false)}><Delete/></IconButton>;

  return (
    <Typography sx={{display: 'flex', alignItems: 'center'}} gutterBottom variant="h5" component="div">
      {tradeMemo.getCoinName()}
      {growthIcon}
      <span style={{marginLeft: 'auto'}}>{editIcon}{deleteIcon}</span>
    </Typography>
  )
}
