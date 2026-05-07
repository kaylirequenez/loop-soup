import type {
  BPM,
  Frequency,
  Note,
  Ticks,
  Time,
  TimeSignature,
  TransportTime,
} from "tone/build/esm/core/type/Units";
import { Midi, TimeClass } from "tone";

/** Re-exported Tone.js unit types for app-wide scheduling/value contracts. */
export type ToneFrequency = Frequency;
export type ToneMidi = Parameters<typeof Midi>[0];
export type ToneTicks = Ticks;
export type ToneTime = Time;
export type ToneTransportTime = TransportTime;
export type ToneTimeBase = ConstructorParameters<typeof TimeClass>[0];
export type ToneNote = Note;

export type ScaleQuality = "maj" | "min";
/** Sharp-only key roots currently supported by UI and store. */
export type KeyRoot =
  | "C"
  | "C#"
  | "D"
  | "D#"
  | "E"
  | "F"
  | "F#"
  | "G"
  | "G#"
  | "A"
  | "A#"
  | "B";

export interface MusicalKey {
  /** Root key name (sharp spelling only). */
  root: KeyRoot;
  /** Scale quality used for diatonic highlighting and pitch mapping. */
  mode: ScaleQuality;
}

export interface Meter {
  /** Time-signature numerator (top number). */
  beatsPerMeasure: Extract<TimeSignature, number>;
  /** Time-signature denominator (bottom number). */
  noteValue: Extract<TimeSignature, number>;
}

export interface CompositionStoreState {
  /** Global tempo in beats per minute. */
  bpm: BPM;
  /** Active project key signature. */
  key: MusicalKey;
  /** Active meter (time signature). */
  meter: Meter;
  /** Roll/softpot anchor octave; not a per-note stored octave. */
  octave: number;
  /** Composition span in measures (1-indexed concept in UX). */
  totalMeasures: number;

  setBpm: (value: BPM) => void;
  setKey: (value: MusicalKey) => void;
  setMeter: (value: Meter) => void;
  setOctave: (value: number) => void;
  setTotalMeasures: (value: number) => void;
}
