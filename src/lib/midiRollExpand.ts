/**
 * Map loop phrase + repeats to global composition beat indices for MIDI roll display.
 */

import { repeatEveryForUnit, repeatIntervalBeats } from "./loopModel";
import type { LayerLoop, LoopNote } from "../types/model";

/** Global beat index of the earliest phrase anchor in the bar (0-based timeline). */
export function phraseGlobalStartBeat(
  loop: LayerLoop,
  beatsPerMeasure: number,
): number {
  const bpm = Math.max(1, beatsPerMeasure);
  const sm = Math.max(1, Math.floor(loop.startMeasure) || 1);
  return (sm - 1) * bpm;
}

/**
 * Repeat offsets (beats) from `phraseGlobalStartBeat` for tiling the span-long pattern.
 */
export function repeatOffsetsFromLoop(
  loop: LayerLoop,
  beatsPerMeasure: number,
  compositionBeats: number,
): number[] {
  const bpm = Math.max(1, beatsPerMeasure);
  const span = Math.max(1, Math.floor(loop.spanBeats) || 1);
  const sm = Math.max(1, Math.floor(loop.startMeasure) || 1);
  const G = (sm - 1) * bpm;
  const repeatStep = repeatIntervalBeats(
    loop.repeatUnit,
    repeatEveryForUnit(loop),
    beatsPerMeasure,
  );

  const maxEnd = Math.max(1, compositionBeats);
  const offsets = new Set([0]);

  const addWhileFits = (o: number) => {
    if (o < 0) return;
    if (G + o + span <= maxEnd + 1e-6 && G + o < compositionBeats + 1e-6) {
      offsets.add(o);
    }
  };

  if (repeatStep != null) {
    for (let k = 0; k < 64; k++) {
      const base = k * repeatStep;
      if (G + base >= compositionBeats) break;
      if (loop.repeatUnit === "measures" && loop.repeatEndMeasure != null) {
        const measureAtBase =
          sm + k * Math.max(1, Math.floor(repeatEveryForUnit(loop) ?? 1));
        if (measureAtBase >= loop.repeatEndMeasure) break;
      }
      addWhileFits(base);
    }
  }

  return [...offsets].sort((a, b) => a - b);
}

interface BaseNote extends Omit<LoopNote, "octave"> {
  layer: string;
  loopIndex?: number;
  octave?: number;
}

export function expandBaseNotesToComposition(
  baseNotes: BaseNote[],
  loop: LayerLoop,
  beatsPerMeasure: number,
  compositionBeats: number,
): (BaseNote & {
  beatIndex: number;
  startInBeat: number;
  lengthInBeat: number;
  _off: number;
})[] {
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
      if (globalStart >= compositionBeats - 1e-9) continue;
      const globalEnd = Math.min(G + off + lb + len, compositionBeats);
      if (globalEnd <= globalStart + 1e-9) continue;
      const beatIndex = Math.floor(globalStart);
      const startInBeat = globalStart - beatIndex;
      const lengthInBeat = globalEnd - globalStart;
      out.push({
        ...base,
        beatIndex,
        startInBeat,
        lengthInBeat,
        _off: off,
      });
    }
  }

  return out;
}
