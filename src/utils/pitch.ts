import type { MusicalKey, ScaleQuality } from "../types/composition";
import type { LoopNote } from "../types/layer";
import { Frequency, Midi } from "tone";

const SCALE_INTERVALS: Record<ScaleQuality, number[]> = {
  maj: [0, 2, 4, 5, 7, 9, 11],
  min: [0, 2, 3, 5, 7, 8, 10],
};

/** Inclusive MIDI bounds used by loop-note and softpot note selection. */
export const LOOP_NOTE_MIDI_MIN = 12;
export const LOOP_NOTE_MIDI_MAX = 127;

/**
 * Returns the pitch class (0–11) for the root of a musical key.
 *
 * @param key - MusicalKey with sharp-spelled root and mode.
 */
export function pitchClassFromKey(key: MusicalKey): number {
  const midi = Frequency(`${key.root}4`).toMidi();
  return (((Math.round(midi) % 12) + 12) % 12);
}

/**
 * Returns the set of diatonic pitch classes for a key (major or minor scale).
 *
 * @param key - MusicalKey to compute the scale for.
 */
export function diatonicPitchClassSet(key: MusicalKey): Set<number> {
  const root = pitchClassFromKey(key);
  const intervals = SCALE_INTERVALS[key.mode];
  return new Set(intervals.map((i) => (root + i) % 12));
}

/**
 * Returns 12 note-name labels for one chromatic octave on the piano roll.
 * Index 0 = highest semitone above root (top of roll), index 11 = root (bottom).
 *
 * @param key - Musical key; determines which pitch class is the bottom row.
 */
export function chromaticOctaveRows(key: MusicalKey): string[] {
  const rootPc = pitchClassFromKey(key);
  return Array.from({ length: 12 }, (_, i) => {
    const pitchClass = (rootPc + (11 - i) + 12) % 12;
    return Midi(12 + pitchClass).toNote().replace(/[0-9]/g, "");
  });
}

/**
 * Row index (0 = top, 11 = bottom) for a pitch class in the 1-octave roll.
 * Row 11 is always the key root; row 0 is the semitone just above the root.
 *
 * @param pitchClass - Pitch class (0–11) to look up.
 * @param key - Musical key that defines the bottom row.
 */
export function pitchClassRowIndex(
  pitchClass: number,
  key: MusicalKey,
): number {
  const rootPc = pitchClassFromKey(key);
  return 11 - ((pitchClass - rootPc + 12) % 12);
}

/**
 * MIDI note number for a loop note. Matches softpot labels:
 * `Math.floor(midi / 12) - 1` is the displayed octave (C4 → 60, etc.).
 */
export function loopNoteToMidi(
  note: Pick<LoopNote, "pitchClass" | "octave">,
): number {
  return (note.octave + 1) * 12 + note.pitchClass;
}

export function isMidiInLoopNoteRange(midi: number): boolean {
  return midi >= LOOP_NOTE_MIDI_MIN && midi <= LOOP_NOTE_MIDI_MAX;
}

const SOFTPOT_STEPS = 24;

/** MIDI note number for the lowest note in a 2-octave SoftPot span. */
function softpotLowestMidi(key: MusicalKey, octave: number): number {
  return (octave + 1) * 12 + pitchClassFromKey(key);
}

/**
 * Generates 24 row descriptors for the SoftPot note-selection column.
 * Index 0 = top (highest pitch), index 23 = bottom (lowest pitch).
 *
 * @param key - Musical key; determines in-key highlighting and root labeling.
 * @param octave - Base octave for the 2-octave span.
 * @returns Array of 24 objects with MIDI number, pitch class, display label,
 *   and flags for whether the row is in-key or is the root.
 */
export function softpotChromoRows(
  key: MusicalKey,
  octave: number,
): {
  index: number;
  midi: number;
  pitchClass: number;
  label: string;
  inKey: boolean;
  isRoot: boolean;
}[] {
  const rootPc = pitchClassFromKey(key);
  const inKey = diatonicPitchClassSet(key);
  const lowest = softpotLowestMidi(key, octave);

  return Array.from({ length: SOFTPOT_STEPS }, (_, i) => {
    const stepsFromBottom = SOFTPOT_STEPS - 1 - i;
    const midi = lowest + stepsFromBottom;
    const pitchClass = ((midi % 12) + 12) % 12;
    const name = Midi(12 + pitchClass).toNote().replace(/[0-9]/g, "");
    const noteOctave = Math.floor(midi / 12) - 1;
    const isRoot = pitchClass === rootPc;
    const label = isRoot ? `${name}${noteOctave}` : name;
    return {
      index: i,
      midi,
      pitchClass,
      label,
      inKey: inKey.has(pitchClass),
      isRoot,
    };
  });
}
