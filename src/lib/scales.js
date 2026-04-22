export function getScaleNotes() {
  // Spec contract: key string -> scale note names.
  return [];
}

export function isInScale() {
  // Spec contract: midi note + scale notes -> boolean inclusion.
  return false;
}

export function detectKeyFromMidi() {
  // Spec contract: detect best key signature from MIDI note set.
  return null;
}

import { softpotMidiFromNormalizedPosition } from "./keyLayout.js";

export { softpotMidiFromNormalizedPosition };

export function positionToMidi(position01, keyName, layerOctave) {
  return softpotMidiFromNormalizedPosition(position01, keyName, layerOctave);
}
