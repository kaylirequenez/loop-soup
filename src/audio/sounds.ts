import type { KnobEffect, SoundId } from "./types";

export const SOUND_CATALOG: Record<SoundId, { displayName: string }> = {
  sawtooth: { displayName: "Saw" },
  sine: { displayName: "Sine" },
  triangle: { displayName: "Triangle" },
  square: { displayName: "Square" },
};

export const ALL_SOUND_IDS = Object.keys(SOUND_CATALOG) as SoundId[];

export const KNOB_LABELS: Record<KnobEffect, string> = {
  attack: "atk",
  decay: "dcy",
  sustain: "sus",
  release: "rel",
};

/** Per-effect audio range. Time params use exponential scaling; sustain is linear. */
const KNOB_RANGES: Record<
  KnobEffect,
  { min: number; max: number; linear?: true }
> = {
  attack: { min: 0, max: 2.0 },
  decay: { min: 0.05, max: 2.0 },
  sustain: { min: 0, max: 1, linear: true },
  release: { min: 0.05, max: 4.0 },
};

/** Maps a 0–1 knob value to the actual audio parameter value (seconds or amplitude). */
export function knobToEnvParam(effect: KnobEffect, value: number): number {
  const { min, max, linear } = KNOB_RANGES[effect];
  if (linear) return value;
  if (min === 0) {
    if (value <= 0) return 0;
    const floor = 0.001;
    return floor * Math.pow(max / floor, value);
  }
  return min * Math.pow(max / min, value);
}
