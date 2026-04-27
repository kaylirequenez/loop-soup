import type { LayerLoopInstance, RepeatUnit } from "../types/layer";
import { getRepeatEveryForUnit } from "./layerState";

function repeatIntervalBeats(
  repeatUnit: RepeatUnit,
  repeatEvery: number | null,
  beatsPerMeasure: number,
): number | null {
  if (repeatEvery == null) {
    return null;
  }
  const every = Math.max(1, Math.floor(repeatEvery));
  const bpm = Math.max(1, beatsPerMeasure);
  return repeatUnit === "beats" ? every : every * bpm;
}

/**
 * Returns beat offsets (relative to instance.startBeat) at which the
 * span-length phrase tiles within the composition, respecting repeatEvery
 * and repeatEndBeat.
 */
export function repeatOffsetsFromLoop(
  instance: LayerLoopInstance,
  spanBeats: number,
  beatsPerMeasure: number,
  compositionBeats: number,
): number[] {
  const span = Math.max(1, Math.floor(spanBeats) || 1);
  const G = instance.startBeat;
  const repeatStep = repeatIntervalBeats(
    instance.repeatUnit,
    getRepeatEveryForUnit(instance.repeatUnit, instance),
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
      if (instance.repeatEndBeat != null && G + base >= instance.repeatEndBeat)
        break;
      addWhileFits(base);
    }
  }

  return [...offsets].sort((a, b) => a - b);
}

/**
 * Expands loop-local notes to global beat positions across all phrase repeats,
 * clipped to the composition boundary. Passes all input fields through;
 * overwrites beatIndex, startInBeat, lengthInBeat with global values and
 * appends _off (the repeat offset that produced each copy).
 */
export function expandBaseNotesToComposition<
  T extends { beatIndex: number; startInBeat?: number; lengthInBeat?: number },
>(
  baseNotes: T[],
  instance: LayerLoopInstance,
  spanBeats: number,
  beatsPerMeasure: number,
  compositionBeats: number,
): (T & { beatIndex: number; startInBeat: number; lengthInBeat: number; _off: number })[] {
  const bpm = Math.max(1, beatsPerMeasure);
  const offsets = repeatOffsetsFromLoop(instance, spanBeats, bpm, compositionBeats);
  const G = instance.startBeat;
  const out = [];

  for (const base of baseNotes) {
    const lb = Math.max(0, Math.floor(base.beatIndex) || 0);
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
      out.push({ ...base, beatIndex, startInBeat, lengthInBeat, _off: off });
    }
  }

  return out;
}
