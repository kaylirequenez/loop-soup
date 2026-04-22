/**
 * Shared key-aware pitch layout for MIDI roll (1 octave) and SoftPot (2 octaves).
 * Convention: lowest pitch at the bottom of the UI; key root is the bottom pitch
 * of the visible range (chromatic column).
 */

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const NATURAL_MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

/** "C maj" / "A min" → pitch class 0–11 (C=0). */
export function parseKeyRootPitchClass(keyName) {
  const rootTok = String(keyName ?? "")
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase();
  if (!rootTok) {
    return 0;
  }
  const base = rootTok.replace("#", "");
  const sharp = rootTok.includes("#");
  const baseIndex = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11,
  }[base];
  if (baseIndex === undefined) {
    return 0;
  }
  return (baseIndex + (sharp ? 1 : 0)) % 12;
}

/** `"C maj"` → `"maj"` | `"min"`. */
export function parseKeyQuality(keyName) {
  const lower = String(keyName ?? "").toLowerCase();
  if (lower.includes("min")) {
    return "min";
  }
  if (lower.includes("maj")) {
    return "maj";
  }
  return "maj";
}

/** Pitch classes (0–11) in the key’s diatonic scale. */
export function diatonicPitchClassSet(keyName) {
  const root = parseKeyRootPitchClass(keyName);
  const quality = parseKeyQuality(keyName);
  const intervals =
    quality === "min" ? NATURAL_MINOR_INTERVALS : MAJOR_INTERVALS;
  return new Set(intervals.map((d) => (root + d) % 12));
}

/**
 * One chromatic octave for the piano-roll labels (generic octave — pitch class only).
 * i=0 top … i=11 bottom; bottom row = key root. No octave numbers on labels (octave lives on notes when a loop is selected).
 */
export function midiRollOctaveRows(rootPitchClass) {
  return Array.from({ length: 12 }, (_, i) => {
    const pitchClass = (rootPitchClass + (11 - i) + 12) % 12;
    const name = NOTE_NAMES[pitchClass];
    return { pitchClass, label: name, rowIndex: i };
  });
}

/** Row index 0–11 (top→bottom) for a pitch class in the 1-octave roll. */
export function midiRollRowIndexForPitchClass(pitchClass, rootPitchClass) {
  return 11 - ((pitchClass - rootPitchClass + 12) % 12);
}

/**
 * MIDI note number (0–127) from chromatic pitch class (0–11) and stored octave index.
 * Matches `softpotLowestMidi` / loop phrasing: middle of layer range uses the same (+1) offset.
 */
export function midiFromPitchClassAndOctave(pitchClass, octave) {
  const pc = ((Math.round(Number(pitchClass)) % 12) + 12) % 12;
  const o = Math.floor(Number(octave));
  if (!Number.isFinite(o)) {
    return pc + 12 * 4;
  }
  return pc + 12 * (o + 1);
}

/**
 * Clamp stored octave so `midiFromPitchClassAndOctave` stays in [0, 127].
 */
export function clampOctaveForPitchClass(pitchClass, octave) {
  const pc = ((Math.round(Number(pitchClass)) % 12) + 12) % 12;
  let o = Math.floor(Number(octave));
  if (!Number.isFinite(o)) {
    o = 3;
  }
  const oMin = Math.ceil((0 - pc) / 12) - 1;
  const oMax = Math.floor((127 - pc) / 12) - 1;
  return Math.min(Math.max(o, oMin), oMax);
}

/**
 * Which stacked MIDI roll (1 = top, 2 = bottom) for “split by root & octave”.
 * Compares the note’s **stored** octave (badge / loop data, 0–7) to `octaveView` (same scale).
 */
export function midiRollSplitRollSlot(noteStoredOctave, octaveView) {
  return noteStoredOctave > octaveView ? 1 : 2;
}

/**
 * Lowest MIDI note for the SoftPot’s 2-octave span (bottom of strip).
 * Stored octave 0–7 / UI 1–8 lines up with the **scientific octave of the key root
 * at the strip midline** (12 semitones above this row): bottom row is one octave
 * lower than that selection.
 */
export function softpotLowestMidi(rootPitchClass, layerOctave) {
  const oct = typeof layerOctave === "number" ? layerOctave : 3;
  return (oct + 1) * 12 + rootPitchClass;
}

/**
 * 24 rows for SoftPot note column: index 0 = top (highest), 23 = bottom (lowest).
 */
export function softpotChromoRows(keyName, layerOctave) {
  const rootPc = parseKeyRootPitchClass(keyName);
  const inKey = diatonicPitchClassSet(keyName);
  const lowest = softpotLowestMidi(rootPc, layerOctave);

  return Array.from({ length: 24 }, (_, i) => {
    const stepsFromBottom = 23 - i;
    const midi = lowest + stepsFromBottom;
    const pitchClass = ((midi % 12) + 12) % 12;
    const name = NOTE_NAMES[pitchClass];
    const noteOctave = Math.floor(midi / 12) - 1;
    const isRoot = pitchClass === rootPc;
    const label = isRoot ? `${name}${noteOctave}` : name;
    return {
      index: i,
      midi,
      pitchClass,
      label,
      inKey: inKey.has(pitchClass),
      isRoot,
    };
  });
}

const SOFTPOT_STEPS = 24;

/**
 * MIDI note for strip position `0…1` (0 = top / high, 1 = bottom).
 * Matches `SoftPot` row indexing and `softpotChromoRows`.
 */
export function softpotMidiFromNormalizedPosition(
  position01,
  keyName,
  layerOctave,
) {
  const lowest = softpotLowestMidi(
    parseKeyRootPitchClass(keyName),
    layerOctave,
  );
  const rowIndex = Math.max(
    0,
    Math.min(SOFTPOT_STEPS - 1, Math.round(position01 * (SOFTPOT_STEPS - 1))),
  );
  return lowest + (SOFTPOT_STEPS - 1 - rowIndex);
}
