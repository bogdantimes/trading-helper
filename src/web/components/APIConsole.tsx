import * as React from "react";
import Terminal, { ColorMode, TerminalOutput } from "react-terminal-ui";
import { Dialog, IconButton, Tooltip } from "@mui/material";
import { useTheme } from "@mui/system";
import { ScriptApp } from "./Common";
import { ClearAll } from "@mui/icons-material";

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
  const [terminalOutput, setTerminalOutput] = React.useState<string[]>([
    `Welcome to the API console!`,
    ``,
    `Please be aware that any manual actions are at your own risk.`,
    `Type \`help\` to see the available commands.`,
  ]);
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

  async function askClarityBot(question: string) {
    const response = await fetch(
      `https://pz2rejeiwkin2clgrq3qp6nawq0glnne.lambda-url.eu-west-3.on.aws`,
      {
        method: `post`,
        headers: {
          "Content-Type": `application/json`,
          Authorization: `Bearer TODO`,
        },
        body: JSON.stringify({
          messages: [{ role: `user`, text: question }],
        }),
      }
    );

    if (!response.ok) {
      const respText = await response.text();
      console.error(response.status, respText);
      throw new Error(
        `ClarityBot service is unavailable. Please try again later.`
      );
    }

    const r = await response.json();
    return `${r.result}\nCost: $${r.cost} | Money left: $${r.moneyLeft}`;
  }

  const onCommand = (command) => {
    if (command.toLocaleLowerCase().trim() === `clear`) {
      setTerminalOutput([]);
      return;
    }
    terminalOutput.push(`$ ${command}`);
    setTerminalOutput(terminalOutput);

    const [cmd, ...args] = command.trim().split(` `);

    setPrompt(`⏳`);
    const spinner = setInterval(() => {
      setPrompt((p) => (p === `⏳` ? `⌛` : `⏳`));
    }, 1000);

    try {
      const onSuccess = (resp: string | any) => {
        setPrompt(`$`);
        clearInterval(spinner);
        if (resp.trim) {
          terminalOutput.push(...resp.split(`\n`));
        } else {
          terminalOutput.push(JSON.stringify(resp, null, 2));
        }
        setTerminalOutput(terminalOutput);
        reFetchState();
      };

      const onError = (resp: Error) => {
        setPrompt(`$`);
        clearInterval(spinner);
        terminalOutput.push(resp.message);
        setTerminalOutput(terminalOutput);
      };

      if (cmd.match(/cbs/gi)) {
        askClarityBot(args.join(` `)).then(onSuccess).catch(onError);
        return;
      }

      if (!ScriptApp?.withSuccessHandler(() => {})[cmd]) {
        terminalOutput.push(`Unrecognized command`);
        setTerminalOutput(terminalOutput);
        return;
      }

      ScriptApp?.withSuccessHandler(onSuccess)
        .withFailureHandler(onError)
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
      <Tooltip title="Clear">
        <IconButton
          aria-label="clear"
          onClick={() => {
            setTerminalOutput([]);
          }}
          sx={{
            position: `absolute`,
            top: `8px`,
            right: `8px`,
            zIndex: 1,
          }}
        >
          <ClearAll color={`primary`} />
        </IconButton>
      </Tooltip>
      <Terminal
        name="API"
        prompt={prompt}
        // Subtract some pixels to accommodate the terminal header and footer
        height={`${terminalDimensions.height - 110}px`}
        colorMode={themeMode === `dark` ? ColorMode.Dark : ColorMode.Light}
        onInput={onCommand}
        redBtnCallback={() => {
          setTerminalOpen(false);
        }}
      >
        <>
          {terminalOutput.map((o, i) => (
            <TerminalOutput key={i}>{o}</TerminalOutput>
          ))}
        </>
      </Terminal>
    </Dialog>
  );
};
