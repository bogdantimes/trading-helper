import React from "react"
import ReactDOM from "react-dom"
import App from "./App"
import { ErrorBoundary } from "react-error-boundary"
import { Alert } from "@mui/material"

const app = document.getElementById(`app`)
ReactDOM.render(
  <ErrorBoundary FallbackComponent={Fallback}>
    <App />
  </ErrorBoundary>,
  app,
)

function Fallback({ error }: { error: Error }) {
  return (
    <Alert severity={`error`}>
      Something went wrong:
      <pre>{error.message}</pre>
    </Alert>
  )
}
