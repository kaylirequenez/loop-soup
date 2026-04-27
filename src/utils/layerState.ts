import type { LayerLoopInstance, LoopNote, RepeatUnit } from "../types/layer";

const MAX_REPEAT_EVERY_MEASURES = 4;

export function maxRepeatEveryForUnit(
  unit: RepeatUnit,
  beatsPerMeasure: number,
): number {
  if (unit === "beats") {
    return beatsPerMeasure - 1;
  }
  return MAX_REPEAT_EVERY_MEASURES;
}

export function isRepeatDisabledForUnit(
  spanBeats: number,
  beatsPerMeasure: number,
  repeatUnit: RepeatUnit,
  frequency: number | null,
): boolean {
  if (frequency == null) return false;
  if (repeatUnit === "measures") return frequency < spanBeats / beatsPerMeasure;
  return frequency < spanBeats;
}

export function getRepeatEveryForUnit(
  unit: RepeatUnit,
  instance: LayerLoopInstance,
): number | null {
  if (unit === "measures") return instance.repeatEveryMeasuresMemory;
  return instance.repeatEveryBeatsMemory;
}

/**
 * Converts a 0-indexed composition beat to 1-based { measure, beat } for display.
 *
 * @param startBeat - 0-indexed beat in the composition; must be a non-negative integer.
 * @param beatsPerMeasure - Beats per measure from the composition meter; must be ≥ 1.
 * @returns { measure, beat } both 1-based.
 */
export function startBeatToDisplay(
  startBeat: number,
  beatsPerMeasure: number,
): { measure: number; beat: number } {
  return {
    measure: Math.floor(startBeat / beatsPerMeasure) + 1,
    beat: (startBeat % beatsPerMeasure) + 1,
  };
}

/**
 * Converts 1-based display { measure, beat } back to a 0-indexed composition beat.
 * Caller is responsible for validating and flooring inputs before calling.
 *
 * @param measure - 1-based measure number; must be a valid integer ≥ 1.
 * @param beat - 1-based beat within the measure; must be in [1, beatsPerMeasure].
 * @param beatsPerMeasure - Beats per measure from the composition meter; must be ≥ 1.
 * @returns 0-indexed beat ≥ 0.
 */
export function displayToStartBeat(
  measure: number,
  beat: number,
  beatsPerMeasure: number,
): number {
  return (measure - 1) * beatsPerMeasure + (beat - 1);
}

// TODO: need to have highest & lowest pitch since keys can change
export function canShiftLoopNoteOctaveBy(
  loopNote: LoopNote,
  delta: number,
): boolean {
  return loopNote.octave + delta >= 0 && loopNote.octave + delta < 8;
}

export function canShiftLoopNotesOctaveBy(
  notes: LoopNote[],
  delta: number,
): boolean {
  if (notes.length === 0) return false;
  return notes.some((n) => canShiftLoopNoteOctaveBy(n, delta));
}
