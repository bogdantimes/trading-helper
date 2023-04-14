import React from "react";
import { Card, CardContent } from "@mui/material";
import { cardWidth } from "../Common";

export default function Home({ children }) {
  return (
    <Card
      sx={{
        boxShadow: 2,
        minWidth: cardWidth,
        borderRadius: `1rem`,
      }}
    >
      <CardContent sx={{ ":last-child": { paddingBottom: `18px` } }}>
        {children}
      </CardContent>
    </Card>
  );
}
