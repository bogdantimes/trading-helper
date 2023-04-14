import React from "react";
import { Card, CardContent } from "@mui/material";
import { cardMaxWidth, cardMinWidth } from "../Common";

export default function HomeCard({ children, bColor = ``, ...props }) {
  return (
    <Card
      {...props}
      sx={{
        boxShadow: 2,
        maxWidth: cardMaxWidth,
        minWidth: cardMinWidth,
        borderRadius: `1rem`,
        border: bColor ? `${bColor} 1px solid` : undefined,
        borderInline: `none`,
      }}
    >
      <CardContent sx={{ ":last-child": { paddingBottom: `18px` } }}>
        {children}
      </CardContent>
    </Card>
  );
}
