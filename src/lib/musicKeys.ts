import type { MusicalKey, Meter, NoteLetter, NoteValue } from "../types/composition";

export const KEY_OPTIONS = [
  "C maj",
  "C min",
  "C# maj",
  "C# min",
  "D maj",
  "D min",
  "D# maj",
  "D# min",
  "E maj",
  "E min",
  "F maj",
  "F min",
  "F# maj",
  "F# min",
  "G maj",
  "G min",
  "G# maj",
  "G# min",
  "A maj",
  "A min",
  "A# maj",
  "A# min",
  "B maj",
  "B min",
];

const KEY_OPTION_SET = new Set(KEY_OPTIONS);
const ROOT_CHARS = new Set(["a", "b", "c", "d", "e", "f", "g"]);

export const normalizeKeyText = (value: unknown): string =>
  String(value ?? "").toLowerCase().replace(/\s+/g, "");

export function normalizeKeyLabel(value: unknown, fallback = "A min"): string {
  const trimmed = String(value ?? "").trim();
  if (KEY_OPTION_SET.has(trimmed)) {
    return trimmed;
  }
  return fallback;
}

export function parseKeyQuery(rawQuery: unknown): {
  quality: string | null;
  needsSharp: boolean;
  root: string | null;
} | null {
  let working = normalizeKeyText(rawQuery);
  if (!working) {
    return null;
  }

  let quality: string | null = null;
  if (working.includes("maj")) {
    quality = "maj";
    working = working.replace("maj", "");
  } else if (working.includes("min")) {
    quality = "min";
    working = working.replace("min", "");
  } else if (working.includes("ma")) {
    quality = "maj";
    working = working.replace("ma", "");
  } else if (working.includes("mi")) {
    quality = "min";
    working = working.replace("mi", "");
  } else if (working.includes("m")) {
    quality = "either";
    working = working.replace("m", "");
  }

  const needsSharp =
    working.includes("#") || String(rawQuery ?? "").includes("#");
  working = working.replaceAll("#", "");

  let root: string | null = null;
  for (const char of working) {
    if (ROOT_CHARS.has(char)) {
      root = char;
      break;
    }
  }

  return { quality, needsSharp, root };
}

export function matchesKeyQuery(keyLabel: string, query: unknown): boolean {
  const parsed = parseKeyQuery(query);
  if (!parsed) {
    return true;
  }

  const [rootLabel, qualityLabel] = keyLabel.toLowerCase().split(" ");
  const keyRoot = rootLabel.replace("#", "");
  const keyIsSharp = rootLabel.includes("#");

  if (parsed.quality === "maj" && qualityLabel !== "maj") {
    return false;
  }
  if (parsed.quality === "min" && qualityLabel !== "min") {
    return false;
  }
  if (parsed.needsSharp && !keyIsSharp) {
    return false;
  }
  if (parsed.root) {
    if (keyRoot !== parsed.root) {
      return false;
    }
    if (!parsed.needsSharp && keyIsSharp) {
      return false;
    }
  }
  return true;
}

const NOTE_LETTERS: NoteLetter[] = ["A", "B", "C", "D", "E", "F", "G"];

export function musicalKeyToString(key: MusicalKey): string {
  const acc = key.accidental === "sharp" ? "#" : key.accidental === "flat" ? "b" : "";
  return `${key.root}${acc} ${key.mode}`;
}

export const DEFAULT_KEY: MusicalKey = { root: "A", accidental: null, mode: "min" };

export function musicalKeyFromString(str: string, fallback: MusicalKey = DEFAULT_KEY): MusicalKey {
  const trimmed = String(str ?? "").trim();
  const parts = trimmed.split(" ");
  const rootPart = parts[0] ?? "";
  const modePart = (parts[1] ?? "").toLowerCase();

  const rootChar = rootPart[0]?.toUpperCase() as NoteLetter | undefined;
  if (!rootChar || !NOTE_LETTERS.includes(rootChar)) return fallback;

  const accidental = rootPart.includes("#") ? "sharp" : rootPart.includes("b") ? "flat" : null;
  const mode = modePart === "maj" || modePart === "min" ? modePart : fallback.mode;

  return { root: rootChar, accidental, mode };
}

export const DEFAULT_METER: Meter = { beatsPerMeasure: 4, noteValue: 4 };

export function meterToString(meter: Meter): string {
  return `${meter.beatsPerMeasure}/${meter.noteValue}`;
}

export function meterFromString(str: string, fallback: Meter = DEFAULT_METER): Meter {
  const parts = String(str ?? "").split("/");
  const top = Number.parseInt(parts[0] ?? "", 10);
  const bottom = Number.parseInt(parts[1] ?? "", 10);
  const noteValue = ([2, 4, 8, 16, 32] as NoteValue[]).includes(bottom as NoteValue)
    ? (bottom as NoteValue)
    : fallback.noteValue;
  return {
    beatsPerMeasure: top > 0 ? top : fallback.beatsPerMeasure,
    noteValue,
  };
}
