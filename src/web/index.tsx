import React from "react"
import App from "./App"
import { ErrorBoundary } from "react-error-boundary"
import { Alert } from "@mui/material"
import { createRoot } from "react-dom/client"

const app = document.getElementById(`app`)
const root = createRoot(app)
root.render(
  <ErrorBoundary FallbackComponent={Fallback}>
    <App />
  </ErrorBoundary>,
)

function Fallback({ error }: { error: Error }) {
  return (
    <Alert severity={`error`}>
      Something went wrong:
      <pre>{error.message}</pre>
    </Alert>
  )
}
