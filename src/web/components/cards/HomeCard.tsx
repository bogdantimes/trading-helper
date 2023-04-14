import React from "react";
import { Card, CardContent } from "@mui/material";
import { cardWidth } from "../Common";

export default function HomeCard({ children, bColor = ``, ...props }) {
  return (
    <Card
      {...props}
      sx={{
        boxShadow: 2,
        minWidth: cardWidth,
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
