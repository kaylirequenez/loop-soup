import type {
  KeyRoot,
  MusicalKey,
} from "../types/composition";

const KEY_ROOTS: KeyRoot[] = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];
const FLAT_TO_SHARP: Record<string, KeyRoot> = {
  DB: "C#",
  EB: "D#",
  GB: "F#",
  AB: "G#",
  BB: "A#",
};

/** Converts structured key data into compact display form like `A# min`. */
export function musicalKeyToString(key: MusicalKey): string {
  return `${key.root} ${key.mode}`;
}

export const DEFAULT_KEY: MusicalKey = {
  root: "A",
  mode: "min",
};

/**
 * Parses key text into `MusicalKey` with fallback for invalid input.
 */
export function musicalKeyFromString(
  str: string,
  fallback: MusicalKey = DEFAULT_KEY,
): MusicalKey {
  const trimmed = String(str ?? "").trim();
  const parts = trimmed.split(" ");
  const rootPart = (parts[0] ?? "").toUpperCase();
  const modePart = (parts[1] ?? "").toLowerCase();
  const sharpRoot = FLAT_TO_SHARP[rootPart] ?? (rootPart as KeyRoot);
  if (!KEY_ROOTS.includes(sharpRoot)) return fallback;
  const mode =
    modePart === "maj" || modePart === "min" ? modePart : fallback.mode;

  return { root: sharpRoot, mode };
}

/** Converts a meter object into `top/bottom` display form. */
export function meterToString(meter: { beatsPerMeasure: number; noteValue: number }): string {
  return `${meter.beatsPerMeasure}/${meter.noteValue}`;
}
