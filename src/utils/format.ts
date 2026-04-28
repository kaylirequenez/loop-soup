import type {
  MusicalKey,
  NoteLetter,
} from "../types/composition";

const NOTE_LETTERS: NoteLetter[] = ["A", "B", "C", "D", "E", "F", "G"];

/** Converts structured key data into compact display form like `A# min`. */
export function musicalKeyToString(key: MusicalKey): string {
  const acc =
    key.accidental === "sharp" ? "#" : key.accidental === "flat" ? "b" : "";
  return `${key.root}${acc} ${key.mode}`;
}

export const DEFAULT_KEY: MusicalKey = {
  root: "A",
  accidental: null,
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
  const rootPart = parts[0] ?? "";
  const modePart = (parts[1] ?? "").toLowerCase();

  const rootChar = rootPart[0]?.toUpperCase() as NoteLetter | undefined;
  if (!rootChar || !NOTE_LETTERS.includes(rootChar)) return fallback;

  const accidental = rootPart.includes("#")
    ? "sharp"
    : rootPart.includes("b")
      ? "flat"
      : null;
  const mode =
    modePart === "maj" || modePart === "min" ? modePart : fallback.mode;

  return { root: rootChar, accidental, mode };
}

/** Converts a meter object into `top/bottom` display form. */
export function meterToString(meter: { beatsPerMeasure: number; noteValue: number }): string {
  return `${meter.beatsPerMeasure}/${meter.noteValue}`;
}
