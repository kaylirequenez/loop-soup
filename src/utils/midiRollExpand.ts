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
