import { clamp } from "../utils";

export const LOOP_OCTAVE_MIN = 0;
export const LOOP_OCTAVE_MAX = 6; // TODO: make sure correct and also see why not changing

export const MAX_COMPOSITION_BEATS = 4;

export function clampLoopOctave(n: number): number {
  return clamp(n, LOOP_OCTAVE_MIN, LOOP_OCTAVE_MAX);
}

export function maxMeasuresCompositionLimit(beatsPerMeasure: number): number {
  const bpm = Math.max(1, beatsPerMeasure);
  return clamp(
    Math.floor(MAX_COMPOSITION_BEATS / bpm),
    1,
    MAX_COMPOSITION_BEATS,
  );
}

export function compositionLoopBeatLength(
  totalMeasures: number,
  beatsPerMeasure: number,
): number {
  return totalMeasures * beatsPerMeasure;
}
