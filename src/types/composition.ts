export type ScaleQuality = "maj" | "min";
export type NoteLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G";
export type Accidental = "sharp" | "flat" | null; // note we only support sharp rn

export interface MusicalKey {
  root: NoteLetter;
  accidental: Accidental;
  mode: ScaleQuality;
}

export type NoteValue = 2 | 4 | 8 | 16 | 32;

export interface Meter {
  beatsPerMeasure: number; // The "top"
  noteValue: NoteValue; // The "bottom"
}

export interface CompositionStoreState {
  bpm: number;
  key: MusicalKey;
  meter: Meter;
  octave: number;
  totalMeasures: number;

  setBpm: (value: number) => void;
  setKey: (value: MusicalKey) => void;
  setMeter: (value: Meter) => void;
  setOctave: (value: number) => void;
  setTotalMeasures: (value: number) => void;
}
