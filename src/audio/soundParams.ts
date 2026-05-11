import { KNOB_SPECS } from "../sound/soundSpecs";
import type { KnobEffect, LayerMixEffect } from "../types/sound";
import { clamp01 } from "../utils";

/** Maps a 0-1 knob value to the actual audio parameter value. */
export function knobToParam(effect: KnobEffect, rawValue: number): number {
  const value = clamp01(rawValue);
  const { min, max, linear } = KNOB_SPECS[effect].range;
  if (linear) return min + value * (max - min);
  if (min === 0) {
    if (value <= 0) return 0;
    const floor = 0.001;
    return floor * Math.pow(max / floor, value);
  }
  return min * Math.pow(max / min, value);
}

export function knobToEnvParam(
  effect: "attack" | "decay" | "sustain" | "release",
  value: number,
): number {
  return knobToParam(effect, value);
}

/** Maps a 0-1 mix knob value to its actual audio parameter value. */
export function mixKnobToParam(
  effect: LayerMixEffect,
  rawValue: number,
): number {
  const value = clamp01(rawValue);
  switch (effect) {
    case "eqLow":
    case "eqMid":
    case "eqHigh":
      return (value - 0.5) * 20;
    case "compThreshold":
      return value * 40 - 40;
    case "compRatio":
      return 1 + value * 19;
    case "compAttack":
      // 0.001s (1ms) → 0.3s (300ms), exponential
      return value <= 0 ? 0.001 : 0.001 * Math.pow(300, value);
    case "compRelease":
      // 0.01s (10ms) → 1.0s, exponential
      return value <= 0 ? 0.01 : 0.01 * Math.pow(100, value);
  }
}

export function panToParam(rawValue: number): number {
  return clamp01(rawValue) * 2 - 1;
}

export function bitCrusherAmountToBits(amount: number): number {
  return Math.max(1, Math.round(16 - clamp01(amount) * 15));
}
