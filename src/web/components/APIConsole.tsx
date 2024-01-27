import * as React from "react";
import { Box, Dialog, IconButton, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/system";
import { ScriptApp, withTrustedEvent } from "./Common";
import { ReactTerminal, TerminalContext } from "react-terminal";
import { ClearAll } from "@mui/icons-material";
import { useContext } from "react";

interface Props {
  terminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  reFetchState: () => void;
}

export const APIConsole: React.FC<Props> = ({
  terminalOpen,
  setTerminalOpen,
  reFetchState,
}) => {
  const theme = useTheme();
  const themeMode = theme.palette.mode;
  const { setBufferedContent } = useContext(TerminalContext);

  const onCommand = async (cmd: string, args: string) => {
    if (!ScriptApp?.withSuccessHandler(() => {})[cmd]) {
      return `Unrecognized command`;
    }

    const output = await new Promise((resolve) => {
      const argsList = args?.split(` `) || [];
      ScriptApp?.withSuccessHandler((resp) => {
        if (resp.trim) {
          resolve(resp);
        } else {
          resolve(JSON.stringify(resp, null, 2));
        }
        reFetchState();
      })
        .withFailureHandler((resp) => {
          resolve(resp.message);
        })
        [cmd](...argsList);
    });

    return `\n${output}\n`; // add some padding
  };

  return (
    <Dialog
      fullWidth={true}
      maxWidth={`md`}
      open={terminalOpen}
      sx={{
        "#terminalEditor": {
          maxHeight: `600px`,
          whiteSpace: `pre-wrap`,
        },
      }}
      onClose={withTrustedEvent(() => {
        setTerminalOpen(false);
      })}
    >
      <Box sx={{ display: `flex`, alignItems: `center` }}>
        <Typography sx={{ ml: `auto` }}>
          Trading Helper v{process.env.npm_package_version}
        </Typography>
        <Tooltip title="Clear">
          <IconButton
            sx={{ ml: `auto` }}
            onClick={() => {
              setBufferedContent(``);
            }}
          >
            <ClearAll color={`primary`} />
          </IconButton>
        </Tooltip>
      </Box>
      <ReactTerminal
        prompt={`$`}
        showControlButtons={false}
        showControlBar={false}
        welcomeMessage={`Welcome to the API console!
Any manual actions are at your own risk.
Type \`help\` to see the available commands.

`}
        theme={`material-${themeMode}`}
        defaultHandler={onCommand}
      />
    </Dialog>
  );
};
