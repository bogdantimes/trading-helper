import React from "react";
import { Box, IconButton, type SvgIconProps } from "@mui/material";
import { Refresh } from "@mui/icons-material";
import { styled, type SxProps, useTheme } from "@mui/system";
import { type Theme } from "@mui/material/styles";

interface StyledRefreshProps extends SvgIconProps {
  isSpinning: boolean;
}

const spinAnimation = `spinAnimation`;

const StyledRefresh = styled(Refresh)<StyledRefreshProps>(
  ({ theme, isSpinning }) => ({
    color: theme.palette.info.main,
    fontSize: `20px`,
    animation: isSpinning ? `${spinAnimation} 1s linear infinite` : `none`,
    [`@keyframes ${spinAnimation}`]: {
      "0%": {
        transform: `rotate(0deg)`,
      },
      "100%": {
        transform: `rotate(360deg)`,
      },
    },
  })
);

const RefreshButton = ({
  isSpinning,
  onClick,
  sx,
}: {
  isSpinning;
  onClick;
  sx?: SxProps<Theme>;
}) => {
  const theme = useTheme();

  return (
    <Box sx={sx} component="span" display="flex" alignItems="center">
      <IconButton onClick={onClick} sx={{ p: 0 }}>
        <StyledRefresh theme={theme} isSpinning={isSpinning} />
      </IconButton>
    </Box>
  );
};

export default RefreshButton;
