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

export function positionToMidi() {
  // Spec contract: SoftPot normalized position -> MIDI note over 24 semitones.
  return null;
}
