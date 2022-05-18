import {TradeMemo} from "../../apps-script/TradeMemo";
import {IconButton} from "@mui/material";
import * as React from "react";
import {
  Delete,
  Edit,
  KeyboardArrowDown,
  KeyboardArrowUp,
  KeyboardDoubleArrowDown,
  KeyboardDoubleArrowUp
} from "@mui/icons-material";
import Typography from "@mui/material/Typography";

const progressMap = new Map<number, JSX.Element>();
progressMap.set(-2, <KeyboardDoubleArrowDown htmlColor={"red"}/>);
progressMap.set(-1, <KeyboardArrowDown htmlColor={"red"}/>);
progressMap.set(1, <KeyboardArrowUp htmlColor={"green"}/>);
progressMap.set(2, <KeyboardDoubleArrowUp htmlColor={"green"}/>);

export function TradeTitle({tradeMemo, onEdit, onDelete}: {
  tradeMemo: TradeMemo,
  onEdit: () => void,
  onDelete: () => void,
}) {

  const growthIndex = tradeMemo.getConsecutiveGrowthIndex(tradeMemo.prices.slice(-3));
  const growthIcon = progressMap.get(growthIndex);

  const editIcon = <IconButton onClick={onEdit} sx={{marginLeft: 'auto'}}><Edit sx={{fontSize: "18px"}}/></IconButton>;
  const deleteIcon = <IconButton onClick={onDelete}><Delete sx={{fontSize: "18px"}}/></IconButton>;

  return (
    <Typography sx={{display: 'flex', alignItems: 'center'}} gutterBottom variant="h5"
                component="div">{tradeMemo.getCoinName()} {growthIcon}{editIcon}{deleteIcon}</Typography>
  )
}
