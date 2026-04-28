import type { LayerLoopInstance, RepeatUnit } from "../types/layer";
import { getRepeatEveryForUnit } from "./layerState";

/**
 * Purpose:
 * Converts repeat configuration into beat-step distance between phrase starts.
 */
function repeatIntervalBeats(
  repeatUnit: RepeatUnit,
  repeatEvery: number | null,
  beatsPerMeasure: number,
): number | null {
  if (repeatEvery == null) {
    return null;
  }
  return repeatUnit === "beats" ? repeatEvery : repeatEvery * beatsPerMeasure;
}

/**
 * Returns beat offsets (relative to instance.startBeat) at which the
 * span-length phrase tiles within the composition, respecting repeatEvery
 * and repeatCount.
 */
export function repeatOffsetsFromLoop(
  instance: LayerLoopInstance,
  spanBeats: number,
  beatsPerMeasure: number,
  compositionBeats: number,
): number[] {
  const G = instance.startBeat;
  const repeatStep = repeatIntervalBeats(
    instance.repeatUnit,
    getRepeatEveryForUnit(instance.repeatUnit, instance),
    beatsPerMeasure,
  );
  if (repeatStep == null) return [0];

  // Extra repeats that can fully fit before composition end.
  const maxByComposition = Math.max(
    0,
    Math.floor((compositionBeats - G - spanBeats + 1e-6) / repeatStep),
  );
  const requestedCount = instance.repeatCount;
  const effectiveCount =
    requestedCount == null
      ? maxByComposition
      : Math.min(requestedCount, maxByComposition);

  const offsets = [0];
  for (let k = 1; k <= effectiveCount; k += 1) {
    offsets.push(k * repeatStep);
  }
  return offsets;
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
): (T & {
  beatIndex: number;
  startInBeat: number;
  lengthInBeat: number;
  _off: number;
})[] {
  const offsets = repeatOffsetsFromLoop(
    instance,
    spanBeats,
    beatsPerMeasure,
    compositionBeats,
  );
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
