import { Midi } from "tone";

/**
 * Centralized Tone.js unit helpers used at the scheduling boundary.
 * We keep song data in beats, then convert once to ticks for Transport/Part.
 */
export function beatsToTicks(beats: number, ppq: number): number {
  return Math.round(beats * ppq);
}

export function ticksToTicksTime(ticks: number): `${number}i` {
  return `${ticks}i`;
}

export function midiToFrequency(midi: number): number {
  return Midi(midi).toFrequency() as number;
}
