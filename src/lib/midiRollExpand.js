/**
 * Map loop phrase + repeats to global composition beat indices for MIDI roll display.
 */

import { repeatIntervalBeats } from "./loopModel";

/** Global beat index of the earliest phrase anchor in the bar (0-based timeline). */
export function phraseGlobalStartBeat(loop, beatsPerMeasure) {
  const bpm = Math.max(1, beatsPerMeasure);
  const sm = Math.max(1, Math.floor(loop.startMeasure) || 1);
  return (sm - 1) * bpm;
}

/**
 * Repeat offsets (beats) from `phraseGlobalStartBeat` for tiling the span-long pattern.
 * Intra-measure: one offset per selected play beat (relative to earliest). Measure repeat: + k × M × bpm.
 */
export function repeatOffsetsFromLoop(
  loop,
  beatsPerMeasure,
  compositionBeats,
) {
  const bpm = Math.max(1, beatsPerMeasure);
  const span = Math.max(1, Math.floor(loop.spanBeats) || 1);
  const sm = Math.max(1, Math.floor(loop.startMeasure) || 1);
  const G = (sm - 1) * bpm;
  const repeatStep = repeatIntervalBeats(
    loop.repeatUnit,
    loop.repeatEvery,
    beatsPerMeasure,
  );

  const maxEnd = Math.max(1, compositionBeats);

  const offsets = new Set([0]);

  const addWhileFits = (o) => {
    if (o < 0) {
      return;
    }
    if (G + o + span <= maxEnd + 1e-6 && G + o < compositionBeats + 1e-6) {
      offsets.add(o);
    }
  };

  if (repeatStep != null) {
    for (let k = 0; k < 64; k++) {
      const base = k * repeatStep;
      if (G + base >= compositionBeats) {
        break;
      }
      if (loop.repeatUnit === "measures" && loop.repeatEndMeasure != null) {
        const measureAtBase = sm + k * Math.max(1, Math.floor(loop.repeatEvery ?? 1));
        if (measureAtBase >= loop.repeatEndMeasure) {
          break;
        }
      }
      addWhileFits(base);
    }
  }

  return [...offsets].sort((a, b) => a - b);
}

/**
 * @param {Array<{ layer: string, loopIndex?: number, pitchClass: number, octave?: number, localBeatIndex: number, startInBeat?: number, lengthInBeat?: number }>} baseNotes
 * @param {object} loop — layer loop object
 */
export function expandBaseNotesToComposition(
  baseNotes,
  loop,
  beatsPerMeasure,
  compositionBeats,
) {
  const bpm = Math.max(1, beatsPerMeasure);
  const offsets = repeatOffsetsFromLoop(loop, bpm, compositionBeats);
  const G = phraseGlobalStartBeat(loop, bpm);
  const out = [];

  for (const base of baseNotes) {
    const lb = Math.max(0, Math.floor(base.localBeatIndex) || 0);
    const s0 = base.startInBeat ?? 0;
    const len = base.lengthInBeat ?? 1;

    for (const off of offsets) {
      const globalStart = G + off + lb + s0;
      if (globalStart >= compositionBeats - 1e-9) {
        continue;
      }
      const globalEnd = Math.min(G + off + lb + len, compositionBeats);
      if (globalEnd <= globalStart + 1e-9) {
        continue;
      }
      const beatIndex = Math.floor(globalStart);
      const startInBeat = globalStart - beatIndex;
      const lengthInBeat = globalEnd - globalStart;
      out.push({
        layer: base.layer,
        loopIndex: base.loopIndex ?? 0,
        pitchClass: base.pitchClass,
        octave: base.octave,
        beatIndex,
        startInBeat,
        lengthInBeat,
        _off: off,
      });
    }
  }

  return out;
}
