import * as React from "react";
import Terminal, {
  ColorMode,
  TerminalInput,
  TerminalOutput,
} from "react-terminal-ui";
import { Dialog } from "@mui/material";
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

  const handleResize = () => {
    const terminalWidth = window.innerWidth * 0.8; // Set terminal width to 80% of the window width
    const terminalHeight = window.innerHeight * 0.8; // Set terminal height to 80% of the window height
    setTerminalDimensions({ width: terminalWidth, height: terminalHeight });
  };

  React.useEffect(() => {
    handleResize();
    window.addEventListener(`resize`, handleResize);
    return () => {
      window.removeEventListener(`resize`, handleResize);
    };
  }, []);

  const [terminalDimensions, setTerminalDimensions] = React.useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  const onCommand = (command) => {
    if (command.toLocaleLowerCase().trim() === `clear`) {
      setTerminalOutput(``);
      return;
    }
    setTerminalOutput(<TerminalInput>{command}</TerminalInput>);

    const [cmd, ...args] = command.split(` `);

    if (!ScriptApp?.withSuccessHandler(() => {})[cmd]) {
      setTerminalOutput(
        <>
          <TerminalInput>{command}</TerminalInput>
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
            <TerminalInput>{command}</TerminalInput>
            {resp.trim ? (
              resp.split(`\n`).map((s, i) => {
                return <TerminalOutput key={i}>{s}</TerminalOutput>;
              })
            ) : (
              <TerminalOutput>{JSON.stringify(resp, null, 2)}</TerminalOutput>
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
  };
  return (
    <Dialog
      fullWidth={true}
      maxWidth={`md`}
      open={terminalOpen}
      sx={{
        [`.react-terminal-line`]: { whiteSpace: `pre-wrap` },
      }}
      onClose={() => {
        setTerminalOpen(false);
      }}
    >
      <Terminal
        name="API"
        prompt={prompt}
        // Subtract some pixels to accommodate the terminal header and footer
        height={`${terminalDimensions.height - 110}px`}
        colorMode={themeMode === `dark` ? ColorMode.Dark : ColorMode.Light}
        onInput={onCommand}
      >
        {terminalOutput}
      </Terminal>
    </Dialog>
  );
};
