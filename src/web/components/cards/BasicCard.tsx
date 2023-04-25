import React from "react";
import { Card, CardContent } from "@mui/material";
import { cardMaxWidth, cardMinWidth } from "../Common";

export default function BasicCard({ children, ...props }) {
  return (
    <Card
      {...props}
      sx={{
        boxShadow: 2,
        minWidth: cardMinWidth,
        maxWidth: cardMaxWidth,
        borderRadius: `1rem`,
      }}
    >
      <CardContent sx={{ ":last-child": { paddingBottom: `18px` } }}>
        {children}
      </CardContent>
    </Card>
  );
}
