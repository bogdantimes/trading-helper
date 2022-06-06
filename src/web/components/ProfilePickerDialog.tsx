import * as React from "react"
import {
  Avatar,
  Dialog,
  DialogTitle,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
} from "@mui/material"
import { blue } from "@mui/material/colors"
import { Person } from "@mui/icons-material"
import { Profile } from "trading-helper-lib"

export interface ProfilePickerDialogProps {
  profiles: { [key: string]: Profile }
  onSelect: (profile: Profile) => void
}

export function ProfilePickerDialog(props: ProfilePickerDialogProps) {
  const { onSelect, profiles } = props

  return (
    <Dialog open={true}>
      <DialogTitle>Choose Profile</DialogTitle>
      <List sx={{ pt: 0 }}>
        {Object.keys(profiles).map((key) => (
          <ListItemButton onClick={() => onSelect(profiles[key])} key={key}>
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: blue[100], color: blue[600] }}>
                <Person />
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={key} />
          </ListItemButton>
        ))}
        {/* <ListItemButton autoFocus onClick={() => ()}> */}
        {/*   <ListItemAvatar> */}
        {/*     <Avatar> */}
        {/*       <Add /> */}
        {/*     </Avatar> */}
        {/*   </ListItemAvatar> */}
        {/*   <ListItemText primary="Add profile" /> */}
        {/* </ListItemButton> */}
      </List>
    </Dialog>
  )
}
