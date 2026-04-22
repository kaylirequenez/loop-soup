import { useCallback } from "react";

export function useMidiPlayheadScrub({
  isPlaying,
  setPlaying,
  setMidiPlayheadBeat,
  lockDragSelect,
  unlockDragSelect,
  scrubResumeRef,
  beatsPerMeasure,
  beatLength,
  midiViewMeasureIndex,
  visibleMeasureCount,
  measureCount,
}) {
  return useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      lockDragSelect();
      const rollEl = e.currentTarget.parentElement;
      if (!rollEl?.classList.contains("combined-roll")) {
        unlockDragSelect();
        return;
      }
      const vpEl = rollEl.closest(".midi-roll-viewport");
      if (!vpEl) {
        unlockDragSelect();
        return;
      }
      if (isPlaying) {
        scrubResumeRef.current = true;
        setPlaying(false);
      } else {
        scrubResumeRef.current = false;
      }
      const scrubEdgeEpsilon = 1e-6;
      const apply = (clientX) => {
        const rect = vpEl.getBoundingClientRect();
        const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const startBeat = midiViewMeasureIndex * beatsPerMeasure;
        const rightExclusive = Math.min(
          beatLength,
          (midiViewMeasureIndex + visibleMeasureCount) * beatsPerMeasure,
        );
        const span = rightExclusive - startBeat;
        if (span <= 0) {
          return;
        }
        let beat = startBeat + frac * span;
        const lastMeasureInView = Math.min(
          measureCount - 1,
          midiViewMeasureIndex + visibleMeasureCount - 1,
        );
        const scrubToLoopEnd = lastMeasureInView >= measureCount - 1;
        if (scrubToLoopEnd) {
          beat = Math.min(beat, beatLength - scrubEdgeEpsilon);
        } else {
          beat = Math.min(beat, rightExclusive - scrubEdgeEpsilon);
        }
        beat = Math.max(0, beat);
        setMidiPlayheadBeat(beat);
      };
      apply(e.clientX);
      vpEl.setPointerCapture(e.pointerId);
      const onMove = (ev) => {
        ev.preventDefault();
        apply(ev.clientX);
      };
      const onUp = () => {
        unlockDragSelect();
        try {
          vpEl.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        vpEl.removeEventListener("pointermove", onMove);
        vpEl.removeEventListener("pointerup", onUp);
        vpEl.removeEventListener("pointercancel", onUp);
        if (scrubResumeRef.current) {
          scrubResumeRef.current = false;
          setPlaying(true);
        }
      };
      vpEl.addEventListener("pointermove", onMove);
      vpEl.addEventListener("pointerup", onUp);
      vpEl.addEventListener("pointercancel", onUp);
    },
    [
      beatLength,
      beatsPerMeasure,
      isPlaying,
      lockDragSelect,
      measureCount,
      midiViewMeasureIndex,
      scrubResumeRef,
      setMidiPlayheadBeat,
      setPlaying,
      unlockDragSelect,
      visibleMeasureCount,
    ],
  );
}
