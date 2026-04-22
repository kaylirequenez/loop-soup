import { useEffect } from "react";
import { useAppStore } from "../store/appStore";

const MAX_DT_MS = 250;

export default function TransportRunner() {
  const isPlaying = useAppStore((s) => s.isPlaying);
  const transportNonce = useAppStore((s) => s.transportNonce);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }

    let rafId = 0;
    let lastT = performance.now();

    const tick = () => {
      const s = useAppStore.getState();
      if (!s.isPlaying) {
        return;
      }

      const now = performance.now();
      const dt = Math.min(now - lastT, MAX_DT_MS);
      lastT = now;
      s.advanceTransportByMs(dt);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, transportNonce]);

  return null;
}
