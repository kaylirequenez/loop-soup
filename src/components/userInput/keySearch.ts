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

type ParsedKeyQuality = "maj" | "min" | "either" | null;

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
  quality: ParsedKeyQuality;
  needsSharp: boolean;
  root: string | null;
} | null {
  let working = normalizeKeyText(rawQuery);
  if (!working) {
    return null;
  }

  let quality: ParsedKeyQuality = null;
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
