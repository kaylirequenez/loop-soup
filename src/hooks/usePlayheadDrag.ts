import { usePointerDrag } from "./usePointerDrag";
import { useTransportStore } from "../store/transportStore";
import {
  pauseForScrub,
  resumeAfterScrub,
  seekTransportBeatAndPanic,
} from "../audio/transportController";

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
  let shouldResumeTransport = false;

  const clampBeatFromClientX = (el: T, clientX: number) => {
    const { startBeat, endBeat } = getBeatWindow();
    const span = Math.max(0, endBeat - startBeat);
    if (span <= 0) return startBeat;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.min(startBeat + frac * span, endBeat - 1e-6);
  };

  const seekTo = (beat: number) => {
    seekTransportBeatAndPanic(beat);
    onSeek(beat);
  };

  return usePointerDrag<T>({
    onStart: (el, event) => {
      if (stopPropagation) event.stopPropagation();
      useTransportStore.getState().setScrubbing(true);
      shouldResumeTransport = pauseForScrub();
      seekTo(clampBeatFromClientX(el, event.clientX));
    },
    onMove: (el, event) => {
      seekTo(clampBeatFromClientX(el, event.clientX));
    },
    onEnd: () => {
      const beat = useTransportStore.getState().playheadBeat;
      useTransportStore.getState().setScrubbing(false);
      if (shouldResumeTransport) {
        resumeAfterScrub(beat);
        shouldResumeTransport = false;
        onResume?.();
      }
      onDragEnd?.();
    },
  });
}
