// Spec contract:
// - Layer E uses fixed vertical zone split:
//   top 20% hihat, middle 40% snare, bottom 40% kick.
// - Kit presets alter synth params, not zone geometry.
export const DRUM_ZONES = [];

export function getZone() {
  return "kick";
}

export const DRUM_KITS = {};
