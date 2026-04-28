import type {
  LayerLoop,
  LayerLoopInstance,
  LoopNote,
  RepeatUnit,
} from "../types/layer";
import { isMidiInLoopNoteRange, loopNoteToMidi } from "./pitch";

const MAX_REPEAT_EVERY_MEASURES = 4;

/**
 * Purpose:
 * Returns the UI max repeat-every value for a repeat unit.
 *
 * Behavior:
 * - Beats mode caps at one less than beatsPerMeasure.
 * - Measures mode uses fixed product cap.
 */
export function maxRepeatEveryForUnit(
  unit: RepeatUnit,
  beatsPerMeasure: number,
): number {
  if (unit === "beats") {
    return beatsPerMeasure - 1;
  }
  return MAX_REPEAT_EVERY_MEASURES;
}

/**
 * Purpose:
 * Detects whether a repeat frequency would be ineffective for a phrase length.
 *
 * Behavior:
 * - Returns true when frequency is shorter than one phrase span for selected unit.
 * - Null frequency is treated as "repeat disabled" and returns false.
 */
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

/**
 * Purpose:
 * Reads the active repeat-every memory based on current repeat unit.
 */
export function getRepeatEveryForUnit(
  unit: RepeatUnit,
  instance: LayerLoopInstance,
): number | null {
  if (unit === "measures") return instance.repeatEveryMeasuresMemory;
  return instance.repeatEveryBeatsMemory;
}

function canShiftLoopNoteOctaveBy(
  loopNote: LoopNote,
  delta: number,
): boolean {
  const nextMidi = loopNoteToMidi(loopNote) + delta * 12;
  return isMidiInLoopNoteRange(nextMidi);
}

/** True when every note can move by `delta` octaves without leaving MIDI bounds. */
export function canShiftLoopNotesOctaveBy(
  notes: LoopNote[],
  delta: number,
): boolean {
  if (notes.length === 0) return false;
  return notes.every((n) => canShiftLoopNoteOctaveBy(n, delta));
}

/**
 * Purpose:
 * Returns loop instances sorted deterministically for timeline rendering.
 *
 * Behavior:
 * - Primary sort by startBeat ascending.
 * - Tie-break on id ascending.
 */
export function listLayerLoopInstancesSorted(
  loop: LayerLoop,
): LayerLoopInstance[] {
  return Object.values(loop.loopInstances).sort((a, b) => {
    if (a.startBeat !== b.startBeat) {
      return a.startBeat - b.startBeat;
    }
    return a.id - b.id;
  });
}
