import { normalizeRaw } from "./softpotNormalize";

export type SoftpotFrame = { a0: number | null; a1: number | null };
type Listener = (frame: SoftpotFrame) => void;

const listeners = new Set<Listener>();
const runningPorts = new WeakSet<SerialPort>();
const openingPorts = new WeakMap<SerialPort, Promise<void>>();
let autoConnectPromise: Promise<void> | null = null;

export function onSoftpotData(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(a0Raw: number, a1Raw: number) {
  const frame: SoftpotFrame = {
    a0: normalizeRaw(a0Raw),
    a1: normalizeRaw(a1Raw),
  };
  listeners.forEach((cb) => cb(frame));
}

async function readLoop(port: SerialPort) {
  if (!port.readable) {
    runningPorts.delete(port);
    return;
  }
  const decoder = new TextDecoderStream();
  void port.readable.pipeTo(decoder.writable as WritableStream<Uint8Array>).catch(() => {});
  const reader = decoder.readable.getReader();
  let buf = "";
  let loggedFirstBytes = false;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!loggedFirstBytes) {
        loggedFirstBytes = true;
        console.log("[softpot] receiving data");
      }
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        const parts = line.split(",");
        if (parts.length === 2) {
          const a0 = parseInt(parts[0], 10);
          const a1 = parseInt(parts[1], 10);
          if (!isNaN(a0) && !isNaN(a1)) emit(a0, a1);
        }
      }
    }
  } catch {
    // port disconnected
  } finally {
    reader.releaseLock();
    runningPorts.delete(port);
  }
}

export async function connectSoftpotPort(
  port: SerialPort,
  options: { required?: boolean } = {},
): Promise<boolean> {
  if (runningPorts.has(port)) return true;
  const opening = openingPorts.get(port);
  if (opening) {
    await opening;
    return runningPorts.has(port);
  }
  if (port.readable) {
    runningPorts.add(port);
    void readLoop(port);
    return true;
  }

  let opened = false;
  const openingPromise = (async (): Promise<void> => {
    try {
      await port.open({ baudRate: 115200 });
      opened = true;
      runningPorts.add(port);
      console.log("[softpot] port opened");
      void readLoop(port);
    } catch (err) {
      if (options.required) console.warn("[softpot] port failed to open", err);
    }
  })().finally(() => {
    openingPorts.delete(port);
  });
  openingPorts.set(port, openingPromise);
  await openingPromise;
  return opened;
}

export async function autoConnect(): Promise<void> {
  if (autoConnectPromise) return autoConnectPromise;
  if (!("serial" in navigator)) return;
  autoConnectPromise = (async () => {
    const ports = await navigator.serial.getPorts();
    if (ports.length === 0) return;
    await Promise.all(ports.map((port) => connectSoftpotPort(port)));
  })().finally(() => {
    autoConnectPromise = null;
  });
  return autoConnectPromise;
}
