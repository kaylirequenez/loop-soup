export type ScaleQuality = "maj" | "min";
export type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";
/** Currently only `sharp` is used in UX, but `flat` is kept for parsing compatibility. */
export type Accidental = "sharp" | "flat" | null;

export interface MusicalKey {
  /** Natural note letter (no accidental applied yet). */
  root: NoteLetter;
  /** Optional accidental; null means natural note. */
  accidental: Accidental;
  /** Scale quality used for diatonic highlighting and pitch mapping. */
  mode: ScaleQuality;
}

export type NoteValue = 2 | 4 | 8 | 16 | 32;

export interface Meter {
  /** Time-signature numerator (top number). */
  beatsPerMeasure: number;
  /** Time-signature denominator (bottom number). */
  noteValue: NoteValue;
}

export interface CompositionStoreState {
  /** Global tempo in beats per minute. */
  bpm: number;
  /** Active project key signature. */
  key: MusicalKey;
  /** Active meter (time signature). */
  meter: Meter;
  /** Roll/softpot anchor octave; not a per-note stored octave. */
  octave: number;
  /** Composition span in measures (1-indexed concept in UX). */
  totalMeasures: number;

  setBpm: (value: number) => void;
  setKey: (value: MusicalKey) => void;
  setMeter: (value: Meter) => void;
  setOctave: (value: number) => void;
  setTotalMeasures: (value: number) => void;
}
