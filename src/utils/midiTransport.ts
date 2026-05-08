import { getTransport } from "tone";
import { computeNowbarBeat } from "./timingTestHarness";

export function transportBeat(): number {
  const transport = getTransport();
  const { beat } = computeNowbarBeat(transport);
  return beat;
}

/**
 * 0-based measure index for a beat position.
 *
 * @param beat - Current playhead beat; should be in [0, beatLength) from wrapBeat.
 * @param beatsPerMeasure - Beats per measure from the composition meter.
 */
export function playheadMeasureIndex(
  beat: number,
  beatsPerMeasure: number,
): number {
  return Math.floor(beat / beatsPerMeasure);
}
