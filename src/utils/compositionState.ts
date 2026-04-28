import { clamp } from "../utils";
import type { MusicalKey } from "../types/composition";
import { LOOP_NOTE_MIDI_MAX, LOOP_NOTE_MIDI_MIN, pitchClassFromKey } from "./pitch";

/** Composition "octave" control: which span the softpot / roll anchor on (not loop note data). */
export const LOOP_OCTAVE_MIN = 0;
/** High enough that top-row MIDI can reach ~127 with typical roots (single-octave roll strip). */
export const LOOP_OCTAVE_MAX = 9;

const SOFTPOT_SPAN_STEPS = 24;

/**
 * Key-aware bounds for the composition octave so the 24-step softpot window
 * always overlaps the allowed loop-note MIDI band.
 *
 * We allow octaves where only part of the strip is valid, so users can scroll
 * through and see the full 12..127 span across key changes.
 */
export function loopOctaveBoundsForKey(key: MusicalKey): {
  min: number;
  max: number;
} {
  const rootPc = pitchClassFromKey(key);
  // windowLow = (oct + 1) * 12 + rootPc
  // windowHigh = windowLow + (SOFTPOT_SPAN_STEPS - 1)
  // Require overlap:
  //   windowHigh >= LOOP_NOTE_MIDI_MIN
  //   windowLow <= LOOP_NOTE_MIDI_MAX
  const minByMidi = Math.ceil(
    (LOOP_NOTE_MIDI_MIN - (SOFTPOT_SPAN_STEPS - 1) - rootPc) / 12 - 1,
  );
  const maxByMidi = Math.floor((LOOP_NOTE_MIDI_MAX - rootPc) / 12 - 1);
  const min = Math.max(LOOP_OCTAVE_MIN, minByMidi);
  const max = Math.min(LOOP_OCTAVE_MAX, maxByMidi);
  return { min, max: Math.max(min, max) };
}

export function clampLoopOctaveForKey(n: number, key: MusicalKey): number {
  const { min, max } = loopOctaveBoundsForKey(key);
  return clamp(n, min, max);
}

export const MAX_COMPOSITION_MEASURES = 32;

/** Hard cap for composition measure count, used by UI guards. */
export function maxMeasuresCompositionLimit(): number {
  return MAX_COMPOSITION_MEASURES;
}

/**
 * Purpose:
 * Computes total composition beat span from measures and meter numerator.
 *
 * Inputs:
 * - totalMeasures: measure count in the project.
 * - beatsPerMeasure: meter numerator.
 *
 * Output:
 * - Total beat length of the composition loop.
 */
export function compositionLoopBeatLength(
  totalMeasures: number,
  beatsPerMeasure: number,
): number {
  return totalMeasures * beatsPerMeasure;
}
