import { useMemo } from "react";
import {
  getEffectiveLayerRollPlacementForNotes,
  getMidiLoopRollPlacement,
  layerLoopsAgreeOnMidiRollPlacement,
  loopPlacementVisibleOnRoll,
} from "../../store/appStore";
import { midiRollRowIndexForPitchClass, midiRollSplitRollSlot } from "../../lib/keyLayout";
import {
  beatsPerMeasureFromMeter,
  compositionLoopBeatLength,
} from "../../lib/midiPlayhead";
import {
  expandBaseNotesToComposition,
  phraseGlobalStartBeat,
} from "../../lib/midiRollExpand";

export function useMidiRollData({
  layers,
  meter,
  masterLoopLength,
  rootPitchClass,
  midiLoopRollPlacement,
  midiRollCount,
  midiRollSplitByRootOctave,
  octaveView,
  layerIds,
}) {
  const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
  const beatLength = compositionLoopBeatLength(masterLoopLength, beatsPerMeasure);

  const combinedNoteEvents = useMemo(() => {
    const out = [];
    for (const layer of layerIds) {
      const layerLoops = layers[layer]?.loops ?? [];
      for (let loopIndex = 0; loopIndex < layerLoops.length; loopIndex++) {
        const loop = layerLoops[loopIndex];
        if (!loop) {
          continue;
        }
        const rawNotes = loop.notes ?? [];
        rawNotes.forEach((n, noteIndex) => {
          const base = {
            layer,
            loopIndex,
            pitchClass: n.pitchClass,
            octave: n.octave,
            localBeatIndex: n.localBeatIndex,
            startInBeat: n.startInBeat ?? 0,
            lengthInBeat: n.lengthInBeat ?? 1,
          };
          const expanded = expandBaseNotesToComposition(
            [base],
            loop,
            beatsPerMeasure,
            beatLength,
          );
          for (const e of expanded) {
            const { _off, ...rest } = e;
            const loopId = loop.id;
            const noteOct = e.octave ?? base.octave ?? 3;
            const baseNoteKey = `${layer}-${loopId}-${noteIndex}`;
            const globalStart = e.beatIndex + (e.startInBeat ?? 0);
            const globalEnd = globalStart + (e.lengthInBeat ?? 1);
            out.push({
              ...rest,
              pitchClass: e.pitchClass,
              loopIndex,
              loopId,
              noteIndex,
              storedOctave: noteOct,
              noteKey: `${layer}-${loopId}-${e.pitchClass}-${noteOct}-${e.beatIndex}-${e.startInBeat}-${e.lengthInBeat}-${_off ?? 0}`,
              baseNoteKey,
              instanceOffset: _off ?? 0,
              globalStart,
              globalEnd,
              rowIndex: midiRollRowIndexForPitchClass(e.pitchClass, rootPitchClass),
            });
          }
        });
      }
    }
    return out;
  }, [beatLength, beatsPerMeasure, layerIds, layers, rootPitchClass]);

  const layerLoopPlacementAgreement = useMemo(() => {
    const out = {};
    for (const id of layerIds) {
      out[id] = layerLoopsAgreeOnMidiRollPlacement(layers, midiLoopRollPlacement, id);
    }
    return out;
  }, [layerIds, layers, midiLoopRollPlacement]);

  const loopInstanceBounds = useMemo(
    () => (layerId, loopId, instanceOffset = 0) => {
      const loop = (layers[layerId]?.loops ?? []).find((l) => l.id === loopId);
      if (!loop) {
        return null;
      }
      const startBeat =
        phraseGlobalStartBeat(loop, beatsPerMeasure) + (instanceOffset ?? 0);
      const endBeat = startBeat + Math.max(1, Number(loop.spanBeats) || 1);
      return { startBeat, endBeat, loop };
    },
    [beatsPerMeasure, layers],
  );

  const overlapRangesWithLoopNotes = useMemo(
    () =>
      (layerId, loopId, noteIndex, startBeat, endBeat, instanceOffset) => {
        const s = Math.min(startBeat, endBeat);
        const e = Math.max(startBeat, endBeat);
        if (e - s <= 1e-9) {
          return [];
        }
        const bounds = loopInstanceBounds(layerId, loopId, instanceOffset);
        if (!bounds) {
          return [];
        }
        return (bounds.loop.notes ?? [])
          .map((other, idx) => {
            if (idx === noteIndex) {
              return null;
            }
            const blockerStart =
              bounds.startBeat +
              (Number(other.localBeatIndex) || 0) +
              (Number(other.startInBeat) || 0);
            const blockerEnd =
              blockerStart + Math.max(0.05, Number(other.lengthInBeat) || 1);
            return {
              startBeat: Math.max(s, blockerStart),
              endBeat: Math.min(e, blockerEnd),
            };
          })
          .filter((seg) => seg && seg.endBeat - seg.startBeat > 1e-9);
      },
    [loopInstanceBounds],
  );

  const isNoteVisibleInMeasure = useMemo(
    () =>
      (note, rollSlot, measureIndex) => {
        if (midiRollSplitByRootOctave && midiRollCount >= 2) {
          const splitSlot = midiRollSplitRollSlot(note.storedOctave ?? 3, octaveView);
          if (rollSlot !== splitSlot) {
            return false;
          }
        } else {
          const layerPlacement = getEffectiveLayerRollPlacementForNotes(
            layers,
            midiLoopRollPlacement,
            note.layer,
          );
          if (!loopPlacementVisibleOnRoll(layerPlacement, rollSlot, midiRollCount)) {
            return false;
          }
          const loopPlacement = getMidiLoopRollPlacement(
            midiLoopRollPlacement,
            note.layer,
            note.loopId,
          );
          if (!loopPlacementVisibleOnRoll(loopPlacement, rollSlot, midiRollCount)) {
            return false;
          }
        }
        if (note.beatIndex >= beatLength) {
          return false;
        }
        return Math.floor(note.beatIndex / beatsPerMeasure) === measureIndex;
      },
    [
      beatLength,
      beatsPerMeasure,
      layers,
      midiLoopRollPlacement,
      midiRollCount,
      midiRollSplitByRootOctave,
      octaveView,
    ],
  );

  return {
    beatsPerMeasure,
    beatLength,
    combinedNoteEvents,
    layerLoopPlacementAgreement,
    loopInstanceBounds,
    overlapRangesWithLoopNotes,
    isNoteVisibleInMeasure,
  };
}

export function noteWithDragPreview(note, dragPreview) {
  const preview = dragPreview;
  const isPreviewNote =
    preview &&
    preview.baseNoteKey === note.baseNoteKey &&
    (preview.instanceOffset ?? 0) === (note.instanceOffset ?? 0);
  if (!isPreviewNote) {
    return note;
  }
  const nextStart = Math.min(preview.startBeat, preview.endBeat);
  const nextEnd = Math.max(preview.startBeat, preview.endBeat);
  const nextLen = Math.max(0.05, nextEnd - nextStart);
  const localStart = Math.max(0, nextStart - Math.floor(nextStart));
  return {
    ...note,
    beatIndex: Math.floor(nextStart),
    startInBeat: localStart,
    lengthInBeat: nextLen,
    globalStart: nextStart,
    globalEnd: nextEnd,
    pitchClass:
      typeof preview.pitchClass === "number" ? preview.pitchClass : note.pitchClass,
    storedOctave:
      typeof preview.octave === "number" ? preview.octave : note.storedOctave,
    rowIndex: typeof preview.rowIndex === "number" ? preview.rowIndex : note.rowIndex,
  };
}
