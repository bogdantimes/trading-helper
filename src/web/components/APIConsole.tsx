import * as React from "react";
import Terminal, {
  ColorMode,
  TerminalInput,
  TerminalOutput,
} from "react-terminal-ui";
import { Box, Dialog } from "@mui/material";
import { useTheme } from "@mui/system";
import { ScriptApp } from "./Common";

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
  const [terminalOutput, setTerminalOutput] = React.useState<
    JSX.Element | string
  >(
    <>
      <TerminalOutput>Welcome to the API console!</TerminalOutput>
      <TerminalOutput></TerminalOutput>
      <TerminalOutput>
        Please be aware that any manual actions are at your own risk.
      </TerminalOutput>
      <TerminalOutput>
        Type `help` to see the available commands.
      </TerminalOutput>
    </>
  );
  const [prompt, setPrompt] = React.useState(`$`);

  return (
    <Dialog
      open={terminalOpen}
      onClose={() => {
        setTerminalOpen(false);
      }}
    >
      <Box width={600} height={400}>
        <Terminal
          name="API"
          prompt={prompt}
          height={`290px`}
          colorMode={themeMode === `dark` ? ColorMode.Dark : ColorMode.Light}
          onInput={(input) => {
            if (input.toLocaleLowerCase().trim() === `clear`) {
              setTerminalOutput(``);
              return;
            }
            setTerminalOutput(<TerminalInput>{input}</TerminalInput>);

            const [cmd, ...args] = input.split(` `);

            if (!ScriptApp?.withSuccessHandler(() => {})[cmd]) {
              setTerminalOutput(
                <>
                  <TerminalInput>{input}</TerminalInput>
                  <TerminalOutput>Unrecognized command</TerminalOutput>
                </>
              );
              return;
            }

            setPrompt(`⏳`);
            const spinner = setInterval(() => {
              setPrompt((p) => (p === `⏳` ? `⌛` : `⏳`));
            }, 1000);

            try {
              ScriptApp?.withSuccessHandler((resp) => {
                setPrompt(`$`);
                clearInterval(spinner);
                setTerminalOutput(
                  <>
                    <TerminalInput>{input}</TerminalInput>
                    {resp.trim ? (
                      resp.split(`\n`).map((s, i) => {
                        return <TerminalOutput key={i}>{s}</TerminalOutput>;
                      })
                    ) : (
                      <TerminalOutput>
                        {JSON.stringify(resp, null, 2)}
                      </TerminalOutput>
                    )}
                  </>
                );
                reFetchState();
              })
                .withFailureHandler((resp) => {
                  setPrompt(`$`);
                  clearInterval(spinner);
                  setTerminalOutput(resp.message);
                })
                [cmd](...args);
            } catch (e) {
              clearInterval(spinner);
            }
          }}
        >
          {terminalOutput}
        </Terminal>
      </Box>
    </Dialog>
  );
};
