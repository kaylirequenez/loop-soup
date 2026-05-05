import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { rebuildLoopTimelineFromStores } from "./utils/subscribeLoopTimeline";

/** Timeline cache must exist before first paint (subscriptions run after mount). */
rebuildLoopTimelineFromStores();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root element");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
