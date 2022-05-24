import * as React from "react"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Typography from "@mui/material/Typography"
import { f2 } from "../../shared-lib/functions"

type StableCoinProps = {
  name: string
  balance: number
}

export default function StableCoin({ name, balance }: StableCoinProps) {
  return (
    <>
      <Card sx={{ width: 332 }}>
        <CardContent sx={{ paddingBottom: 0 }}>
          <Typography variant="h5">{name}</Typography>
          <Typography variant="h6">{f2(balance)}</Typography>
        </CardContent>
      </Card>
    </>
  )
}
