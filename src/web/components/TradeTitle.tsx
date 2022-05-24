import { IconButton, useTheme } from "@mui/material"
import * as React from "react"
import { useState } from "react"
import {
  Delete,
  Edit,
  KeyboardArrowDown,
  KeyboardArrowUp,
  KeyboardDoubleArrowDown,
  KeyboardDoubleArrowUp,
} from "@mui/icons-material"
import Typography from "@mui/material/Typography"
import { TradeMemo } from "../../shared-lib/TradeMemo"
import { PriceMove, TradeState } from "../../shared-lib/types"

const growthIconMap = new Map<PriceMove, JSX.Element>()
growthIconMap.set(PriceMove.STRONG_DOWN, <KeyboardDoubleArrowDown htmlColor={`red`} />)
growthIconMap.set(PriceMove.DOWN, <KeyboardArrowDown htmlColor={`red`} />)
growthIconMap.set(PriceMove.UP, <KeyboardArrowUp htmlColor={`green`} />)
growthIconMap.set(PriceMove.STRONG_UP, <KeyboardDoubleArrowUp htmlColor={`green`} />)

export function TradeTitle({ tradeMemo, onEdit, onDelete }: {
  tradeMemo: TradeMemo,
  onEdit: () => void,
  onDelete: () => void,
}) {

  const theme = useTheme()
  const [editHover, setEditHover] = useState(false)
  const [deleteHover, setDeleteHover] = useState(false)

  const editColor = editHover ? theme.palette.action.active : theme.palette.action.disabled
  const editIcon = tradeMemo.stateIs(TradeState.BOUGHT) &&
    <IconButton onClick={onEdit} sx={{ color: editColor }}
                onMouseEnter={() => setEditHover(true)}
                onMouseLeave={() => setEditHover(false)}><Edit /></IconButton>
  const deleteColor = deleteHover ? theme.palette.action.active : theme.palette.action.disabled
  const deleteIcon = <IconButton onClick={onDelete} sx={{ color: deleteColor }}
                                 onMouseEnter={() => setDeleteHover(true)}
                                 onMouseLeave={() => setDeleteHover(false)}><Delete /></IconButton>

  return (
    <Typography sx={{ display: `flex`, alignItems: `center` }} gutterBottom variant='h5' component='div'>
      {tradeMemo.getCoinName()}
      {growthIconMap.get(tradeMemo.getPriceMove())}
      <span style={{ marginLeft: `auto` }}>{editIcon}{deleteIcon}</span>
    </Typography>
  )
}
