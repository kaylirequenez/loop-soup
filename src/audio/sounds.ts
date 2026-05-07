import type { LayerId } from "../types/layer";
import type { KnobEffect, SoundId } from "./types";

export interface SoundDef {
  displayName: string;
  /** Default 0–1 knob values for each ADSR param when this sound is first assigned. */
  defaultKnobs: Record<KnobEffect, number>;
}

export const SOUND_CATALOG: Record<NonNullable<SoundId>, SoundDef> = {
  sawtooth: {
    displayName: "Saw",
    defaultKnobs: { attack: 0.10, decay: 0.30, sustain: 0.40, release: 0.35 },
  },
  sine: {
    displayName: "Sine",
    defaultKnobs: { attack: 0.25, decay: 0.40, sustain: 0.70, release: 0.45 },
  },
  triangle: {
    displayName: "Triangle",
    defaultKnobs: { attack: 0.50, decay: 0.40, sustain: 0.80, release: 0.55 },
  },
  square: {
    displayName: "Square",
    defaultKnobs: { attack: 0.05, decay: 0.20, sustain: 0.00, release: 0.10 },
  },
};

export const ALL_SOUND_IDS = Object.keys(SOUND_CATALOG) as NonNullable<SoundId>[];

export const KNOB_LABELS: Record<KnobEffect, string> = {
  attack:  "atk",
  decay:   "dcy",
  sustain: "sus",
  release: "rel",
};

/** Per-effect audio range. Time params use exponential scaling; sustain is linear. */
const KNOB_RANGES: Record<KnobEffect, { min: number; max: number; linear?: true }> = {
  attack:  { min: 0.001, max: 2.0 },
  decay:   { min: 0.050, max: 2.0 },
  sustain: { min: 0,     max: 1,   linear: true },
  release: { min: 0.050, max: 4.0 },
};

/** Maps a 0–1 knob value to the actual audio parameter value (seconds or amplitude). */
export function knobToEnvParam(effect: KnobEffect, value: number): number {
  const { min, max, linear } = KNOB_RANGES[effect];
  if (linear) return value;
  return min * Math.pow(max / min, value);
}

export const DEFAULT_SOUND_FOR_LAYER: Record<LayerId, NonNullable<SoundId>> = {
  A: "sawtooth",
  B: "sine",
  C: "sawtooth",
  D: "triangle",
  E: "square",
};

export function defaultSoundForLayer(layerId: LayerId): NonNullable<SoundId> {
  return DEFAULT_SOUND_FOR_LAYER[layerId];
}
