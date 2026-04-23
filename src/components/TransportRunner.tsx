import { useEffect } from "react";
import { useMidiStore } from "../store/midiStore";
import { useTransportStore } from "../store/transportStore";

const MAX_DT_MS = 250;

export default function TransportRunner() {
  const isPlaying = useTransportStore((s) => s.isPlaying);
  const transportNonce = useTransportStore((s) => s.transportNonce);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }

    let rafId = 0;
    let lastT = performance.now();

    const tick = () => {
      const transportState = useTransportStore.getState();
      if (!transportState.isPlaying) {
        return;
      }

      const now = performance.now();
      const dt = Math.min(now - lastT, MAX_DT_MS);
      lastT = now;
      useMidiStore.getState().advanceTransportByMs(dt);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, transportNonce]);

  return null;
}
