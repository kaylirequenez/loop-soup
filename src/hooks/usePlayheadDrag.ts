import { useRef } from "react";
import { usePointerDrag } from "./usePointerDrag";
import { useTransportStore } from "../store/transportStore";

interface BeatWindow {
  startBeat: number;
  endBeat: number;
}

interface UsePlayheadDragConfig<T extends HTMLElement> {
  getBeatWindow: () => BeatWindow;
  onSeek: (beat: number) => void;
  onDragEnd?: () => void;
  onResume?: () => void;
  stopPropagation?: boolean;
}

export function usePlayheadDrag<T extends HTMLElement>({
  getBeatWindow,
  onSeek,
  onDragEnd,
  onResume,
  stopPropagation = true,
}: UsePlayheadDragConfig<T>) {
  const wasPlayingRef = useRef(false);

  const clampBeatFromClientX = (el: T, clientX: number) => {
    const { startBeat, endBeat } = getBeatWindow();
    const span = Math.max(0, endBeat - startBeat);
    if (span <= 0) return startBeat;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.min(startBeat + frac * span, endBeat - 1e-6);
  };

  return usePointerDrag<T>({
    onStart: (el, event) => {
      if (stopPropagation) event.stopPropagation();
      const t = useTransportStore.getState();
      wasPlayingRef.current = t.isPlaying;
      if (t.isPlaying) t.setPlaying(false);
      onSeek(clampBeatFromClientX(el, event.clientX));
    },
    onMove: (el, event) => {
      onSeek(clampBeatFromClientX(el, event.clientX));
    },
    onEnd: () => {
      if (wasPlayingRef.current) {
        wasPlayingRef.current = false;
        useTransportStore.getState().setPlaying(true);
        onResume?.();
      }
      onDragEnd?.();
    },
  });
}
