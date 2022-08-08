import { IconButton, useTheme } from "@mui/material"
import * as React from "react"
import { useState } from "react"
import { Delete } from "@mui/icons-material"
import Typography from "@mui/material/Typography"
import { TradeMemo } from "../../lib"
import { growthIconMap } from "./Common"

export function TradeTitle({
  tradeMemo,
  onDelete,
}: {
  tradeMemo: TradeMemo
  onDelete: () => void
}) {
  const theme = useTheme()
  const [deleteHover, setDeleteHover] = useState(false)

  const deleteColor = deleteHover ? theme.palette.action.active : theme.palette.action.disabled
  const deleteIcon = (
    <IconButton
      onClick={onDelete}
      sx={{ color: deleteColor }}
      onMouseEnter={() => setDeleteHover(true)}
      onMouseLeave={() => setDeleteHover(false)}
    >
      <Delete />
    </IconButton>
  )

  return (
    <Typography
      sx={{ display: `flex`, alignItems: `center` }}
      gutterBottom
      variant="h5"
      component="div"
    >
      {tradeMemo.getCoinName()}
      {growthIconMap.get(tradeMemo.getPriceMove())}
      <span style={{ marginLeft: `auto` }}>{deleteIcon}</span>
    </Typography>
  )
}
