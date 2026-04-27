import { useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useMidiStore } from "../../store/midiStore";
import { useTransportStore } from "../../store/transportStore";
import { useCompositionStore } from "../../store/compositionStore";
import { compositionLoopBeatLength } from "../../utils/compositionState";

export function useMidiPlayheadScrub() {
  const scrubResumeRef = useRef(false);

  return useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    document.body.classList.add("drag-selection-lock");

    const rollEl = event.currentTarget.parentElement;
    if (!rollEl?.classList.contains("combined-roll")) {
      document.body.classList.remove("drag-selection-lock");
      return;
    }
    const vpEl = rollEl.closest(".midi-roll-viewport");
    if (!(vpEl instanceof HTMLElement)) {
      document.body.classList.remove("drag-selection-lock");
      return;
    }

    const { isPlaying, setPlaying } = useTransportStore.getState();
    if (isPlaying) {
      scrubResumeRef.current = true;
      setPlaying(false);
    } else {
      scrubResumeRef.current = false;
    }

    const apply = (clientX: number) => {
      const { midiViewMeasureIndex, midiMeasuresVisible, setMidiPlayheadBeat } =
        useMidiStore.getState();
      const { meter, totalMeasures } = useCompositionStore.getState();
      const beatsPerMeasure = meter.beatsPerMeasure;
      const beatLength = compositionLoopBeatLength(totalMeasures, beatsPerMeasure);
      const measureCount = Math.max(1, Math.ceil(beatLength / beatsPerMeasure));
      const visibleMeasureCount = Math.max(
        1,
        Math.min(midiMeasuresVisible, measureCount, 4),
      );

      const domRect = vpEl.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - domRect.left) / domRect.width));
      const startBeat = midiViewMeasureIndex * beatsPerMeasure;
      const rightExclusive = Math.min(
        beatLength,
        (midiViewMeasureIndex + visibleMeasureCount) * beatsPerMeasure,
      );
      const span = rightExclusive - startBeat;
      if (span <= 0) return;

      let beat = startBeat + frac * span;
      const lastMeasureInView = Math.min(
        measureCount - 1,
        midiViewMeasureIndex + visibleMeasureCount - 1,
      );
      if (lastMeasureInView >= measureCount - 1) {
        beat = Math.min(beat, beatLength - 1e-6);
      } else {
        beat = Math.min(beat, rightExclusive - 1e-6);
      }
      setMidiPlayheadBeat(Math.max(0, beat));
    };

    apply(event.clientX);
    vpEl.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      apply(moveEvent.clientX);
    };
    const onUp = () => {
      document.body.classList.remove("drag-selection-lock");
      try {
        vpEl.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      vpEl.removeEventListener("pointermove", onMove);
      vpEl.removeEventListener("pointerup", onUp);
      vpEl.removeEventListener("pointercancel", onUp);
      if (scrubResumeRef.current) {
        scrubResumeRef.current = false;
        useTransportStore.getState().setPlaying(true);
      }
    };
    vpEl.addEventListener("pointermove", onMove);
    vpEl.addEventListener("pointerup", onUp);
    vpEl.addEventListener("pointercancel", onUp);
  }, []);
}
