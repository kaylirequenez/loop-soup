import { useState } from "react";
import { connectSoftpotPort } from "../hardware/softpotSerial";

async function requestSoftpotPort() {
  if (!("serial" in navigator)) return;
  const port = await navigator.serial.requestPort();
  await connectSoftpotPort(port, { required: true });
}

function clearPersistedSession() {
  try {
    [
      "loop-soup",
      "loop-soup-layers",
      "loop-soup-transport",
      "loop-soup-composition",
      "loop-soup-loop-definitions",
    ].forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore quota / private mode */
  }
  window.location.reload();
}

export default function DevToolbar() {
  const [connected, setConnected] = useState(false);

  async function handleConnectHardware() {
    try {
      await requestSoftpotPort();
      setConnected(true);
    } catch {
      // user cancelled port picker
    }
  }

  return (
    <div className="dev-toolbar">
      <button
        type="button"
        onClick={clearPersistedSession}
        title="Clear saved session in localStorage and reload"
      >
        clear saved state
      </button>
      {"serial" in navigator && (
        <button
          type="button"
          onClick={handleConnectHardware}
          title="Grant browser access to the softpot serial port (one-time)"
        >
          {connected ? "softpot port open" : "connect softpot"}
        </button>
      )}
    </div>
  );
}
