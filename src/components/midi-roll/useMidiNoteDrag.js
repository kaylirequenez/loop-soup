import { useCallback } from "react";
import { useAppStore } from "../../store/appStore";
import { midiFromPitchClassAndOctave } from "../../lib/keyLayout";
import {
  clampDraggedIntervalToBounds,
  subtractOverlapRanges,
} from "../../lib/midiNoteOverlap";

export function useMidiNoteDrag({
  beatsPerMeasure,
  beatLength,
  visibleMeasureCount,
  midiViewMeasureIndex,
  rootPitchClass,
  loopInstanceBounds,
  overlapRangesWithLoopNotes,
  setLoopNotes,
  applyMidiNoteTap,
  setPendingOverlapKey,
  setDragPreview,
  setActiveDragNoteKey,
  lockDragSelect,
  unlockDragSelect,
  midiRollRowIndexForPitchClass,
}) {
  const handleNotePointerDown = useCallback(
    (e, { rect, inLoopEditMode, rollSlot, noteGlobalStart, noteGlobalEnd }) => {
      if (!rect.loopId || !rect.noteKey) {
        return;
      }
      const isLeftClick = e.pointerType !== "mouse" || e.button === 0;
      if (!isLeftClick) {
        return;
      }
      if (!inLoopEditMode) {
        applyMidiNoteTap({
          layerId: rect.layer,
          loopId: rect.loopId,
          noteKey: rect.noteKey,
          rollSlot,
        });
        return;
      }
      e.preventDefault();
      lockDragSelect();
      const bounds = loopInstanceBounds(rect.layer, rect.loopId, rect.instanceOffset);
      if (!bounds) {
        unlockDragSelect();
        return;
      }
      const vpEl = e.currentTarget.closest(".midi-roll-viewport");
      const rollEl = e.currentTarget.closest(".combined-roll");
      if (!vpEl || !rollEl) {
        unlockDragSelect();
        return;
      }
      const vpRect = vpEl.getBoundingClientRect();
      const startBeat = midiViewMeasureIndex * beatsPerMeasure;
      const endBeat = Math.min(
        beatLength,
        (midiViewMeasureIndex + visibleMeasureCount) * beatsPerMeasure,
      );
      const span = Math.max(1e-6, endBeat - startBeat);
      const originPitchClass = ((Number(rect.pitchClass) % 12) + 12) % 12;
      const originOctave = Math.floor(Number(rect.storedOctave ?? 3));
      const originMidi = Math.max(
        0,
        Math.min(
          127,
          midiFromPitchClassAndOctave(originPitchClass, originOctave),
        ),
      );
      const origin = {
        start: noteGlobalStart,
        end: noteGlobalEnd,
        pointerBeat:
          startBeat + ((e.clientX - vpRect.left) / vpRect.width) * span,
        pointerX: e.clientX,
        pointerY: e.clientY,
        pointerRow: (() => {
          const rr = rollEl.getBoundingClientRect();
          return Math.floor(
            ((e.clientY - rr.top) / Math.max(1e-6, rr.height)) * 12,
          );
        })(),
        midi: originMidi,
      };
      const rowIndexFromClientY = (clientY) => {
        const rr = rollEl.getBoundingClientRect();
        return Math.floor(((clientY - rr.top) / Math.max(1e-6, rr.height)) * 12);
      };
      setPendingOverlapKey(null);
      setDragPreview(null);
      let dragStarted = false;
      let latestDragPreview = null;
      const onMove = (ev) => {
        const moveDist = Math.hypot(
          ev.clientX - origin.pointerX,
          ev.clientY - origin.pointerY,
        );
        if (!dragStarted && moveDist < 4) {
          return;
        }
        if (!dragStarted) {
          dragStarted = true;
          setActiveDragNoteKey(rect.baseNoteKey);
          try {
            vpEl.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }
        ev.preventDefault();
        const beatAtPointer =
          startBeat + ((ev.clientX - vpRect.left) / vpRect.width) * span;
        const beatDelta = beatAtPointer - origin.pointerBeat;
        const len = origin.end - origin.start;
        const rawStart = origin.start + beatDelta;
        const barrierStart = bounds.startBeat;
        const barrierEnd = Math.max(bounds.startBeat, bounds.endBeat - len);
        const nextStart = Math.max(barrierStart, Math.min(barrierEnd, rawStart));
        const nextEnd = nextStart + len;
        const pointerRow = rowIndexFromClientY(ev.clientY);
        const semitoneDelta = origin.pointerRow - pointerRow;
        const nextMidi = Math.max(0, Math.min(127, origin.midi + semitoneDelta));
        const nextPitch = ((nextMidi % 12) + 12) % 12;
        const nextOctave = Math.floor(nextMidi / 12) - 1;
        const overlapRanges = overlapRangesWithLoopNotes(
          rect.layer,
          rect.loopId,
          rect.noteIndex,
          nextStart,
          nextEnd,
          rect.instanceOffset,
        );
        const hasOverlap = overlapRanges.length > 0;
        setPendingOverlapKey(hasOverlap ? rect.baseNoteKey : null);
        const nextPreview = {
          baseNoteKey: rect.baseNoteKey,
          instanceOffset: rect.instanceOffset ?? 0,
          startBeat: nextStart,
          endBeat: nextEnd,
          pitchClass: nextPitch,
          octave: nextOctave,
          rowIndex: midiRollRowIndexForPitchClass(nextPitch, rootPitchClass),
          overlapRanges,
        };
        latestDragPreview = nextPreview;
        setDragPreview(nextPreview);
      };
      const onUp = () => {
        unlockDragSelect();
        if (!dragStarted) {
          if (rect.baseNoteKey) {
            applyMidiNoteTap({
              layerId: rect.layer,
              loopId: rect.loopId,
              noteKey: rect.baseNoteKey,
              rollSlot,
            });
          }
          vpEl.removeEventListener("pointermove", onMove);
          vpEl.removeEventListener("pointerup", onUp);
          vpEl.removeEventListener("pointercancel", onUp);
          setDragPreview(null);
          return;
        }
        const preview = latestDragPreview;
        if (
          preview &&
          preview.baseNoteKey === rect.baseNoteKey &&
          (preview.instanceOffset ?? 0) === (rect.instanceOffset ?? 0)
        ) {
          const inBounds = clampDraggedIntervalToBounds(
            preview.startBeat,
            preview.endBeat,
            bounds,
          );
          const st = useAppStore.getState();
          const loop = (st.layers[rect.layer]?.loops ?? []).find(
            (l) => l.id === rect.loopId,
          );
          const notes = Array.isArray(loop?.notes) ? loop.notes : [];
          const baseNote = notes[rect.noteIndex];
          if (baseNote) {
            const shouldTrim =
              Array.isArray(preview.overlapRanges) &&
              preview.overlapRanges.length > 0;
            const finalSegments = shouldTrim
              ? subtractOverlapRanges(
                  inBounds.startBeat,
                  inBounds.endBeat,
                  preview.overlapRanges,
                )
              : [inBounds];
            const mappedSegments = finalSegments.map((seg) => {
              const finalInBounds = clampDraggedIntervalToBounds(
                seg.startBeat,
                seg.endBeat,
                bounds,
              );
              const newLocalStart = Math.max(
                0,
                finalInBounds.startBeat - bounds.startBeat,
              );
              return {
                ...baseNote,
                localBeatIndex: Math.floor(newLocalStart),
                startInBeat: newLocalStart - Math.floor(newLocalStart),
                lengthInBeat: Math.max(
                  0.05,
                  finalInBounds.endBeat - finalInBounds.startBeat,
                ),
                pitchClass:
                  typeof preview.pitchClass === "number"
                    ? preview.pitchClass
                    : rect.pitchClass,
                octave:
                  typeof preview.octave === "number"
                    ? preview.octave
                    : rect.storedOctave,
              };
            });
            const nextNotes = notes.flatMap((n, idx) =>
              idx !== rect.noteIndex ? [n] : mappedSegments,
            );
            setLoopNotes(rect.layer, rect.loopId, nextNotes);
          }
        }
        try {
          vpEl.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        vpEl.removeEventListener("pointermove", onMove);
        vpEl.removeEventListener("pointerup", onUp);
        vpEl.removeEventListener("pointercancel", onUp);
        setActiveDragNoteKey(null);
        setPendingOverlapKey(null);
        setDragPreview(null);
      };
      vpEl.addEventListener("pointermove", onMove);
      vpEl.addEventListener("pointerup", onUp);
      vpEl.addEventListener("pointercancel", onUp);
    },
    [
      applyMidiNoteTap,
      beatLength,
      beatsPerMeasure,
      lockDragSelect,
      loopInstanceBounds,
      midiRollRowIndexForPitchClass,
      midiViewMeasureIndex,
      overlapRangesWithLoopNotes,
      rootPitchClass,
      setActiveDragNoteKey,
      setDragPreview,
      setLoopNotes,
      setPendingOverlapKey,
      unlockDragSelect,
      visibleMeasureCount,
    ],
  );

  return { handleNotePointerDown };
}
