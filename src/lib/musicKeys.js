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

export const normalizeKeyText = (value) => String(value ?? "").toLowerCase().replace(/\s+/g, "");

export function normalizeKeyLabel(value, fallback = "A min") {
  const trimmed = String(value ?? "").trim();
  if (KEY_OPTION_SET.has(trimmed)) {
    return trimmed;
  }
  return fallback;
}

export function parseKeyQuery(rawQuery) {
  let working = normalizeKeyText(rawQuery);
  if (!working) {
    return null;
  }

  let quality = null;
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

  const needsSharp = working.includes("#") || String(rawQuery ?? "").includes("#");
  working = working.replaceAll("#", "");

  let root = null;
  for (const char of working) {
    if (ROOT_CHARS.has(char)) {
      root = char;
      break;
    }
  }

  return { quality, needsSharp, root };
}

export function matchesKeyQuery(keyLabel, query) {
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

function keyRootPitchClass(keyName) {
  const rootTok = String(keyName ?? "").trim().split(/\s+/)[0]?.toLowerCase();
  if (!rootTok) {
    return 0;
  }
  const base = rootTok.replace("#", "");
  const sharp = rootTok.includes("#");
  const baseIndex = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[base];
  if (baseIndex === undefined) {
    return 0;
  }
  return (baseIndex + (sharp ? 1 : 0)) % 12;
}

export function keySemitoneDelta(fromKey, toKey) {
  const fromPc = keyRootPitchClass(fromKey);
  const toPc = keyRootPitchClass(toKey);
  return toPc - fromPc;
}

export function transposePitchClassByKeys(pitchClass, fromKey, toKey) {
  const pc = Math.round(Number(pitchClass));
  if (!Number.isFinite(pc)) {
    return 0;
  }
  const delta = keySemitoneDelta(fromKey, toKey);
  return ((pc + delta) % 12 + 12) % 12;
}
