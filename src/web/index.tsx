import React from "react";
import App from "./App";
import { createRoot } from "react-dom/client";
import { TerminalContextProvider } from "react-terminal";

const app = document.getElementById(`app`);
const root = createRoot(app);
root.render(
  <TerminalContextProvider>
    <App />
  </TerminalContextProvider>
);
