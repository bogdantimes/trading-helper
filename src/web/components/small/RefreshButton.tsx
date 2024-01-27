import React from "react";
import { Box, IconButton, type SvgIconProps } from "@mui/material";
import { Refresh } from "@mui/icons-material";
import { styled, type SxProps, useTheme } from "@mui/system";
import { type Theme } from "@mui/material/styles";

interface StyledRefreshProps extends SvgIconProps {
  isspinning: boolean;
}

const spinAnimation = `spinAnimation`;

const StyledRefresh = styled(Refresh)<StyledRefreshProps>(
  ({ theme, isspinning }) => ({
    color: theme.palette.info.main,
    fontSize: `20px`,
    animation: isspinning ? `${spinAnimation} 1s linear infinite` : `none`,
    [`@keyframes ${spinAnimation}`]: {
      "0%": {
        transform: `rotate(0deg)`,
      },
      "100%": {
        transform: `rotate(360deg)`,
      },
    },
  }),
);

const RefreshButton = ({
  isspinning,
  onClick,
  sx,
}: {
  isspinning;
  onClick;
  sx?: SxProps<Theme>;
}) => {
  const theme = useTheme();

  return (
    <Box sx={sx} component="span" display="flex" alignItems="center">
      <IconButton onClick={onClick} sx={{ p: 0 }}>
        <StyledRefresh theme={theme} isspinning={isspinning || undefined} />
      </IconButton>
    </Box>
  );
};

export default RefreshButton;
