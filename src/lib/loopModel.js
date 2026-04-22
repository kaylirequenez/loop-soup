import { clampOctaveForPitchClass } from "./keyLayout";

/**
 * @typedef {{
 *   pitchClass: number,
 *   octave: number,
 *   localBeatIndex: number,
 *   startInBeat?: number,
 *   lengthInBeat?: number
 * }} LoopNote
 */

/**
 * @typedef {{
 *   id: string,
 *   startMeasure: number,
 *   spanBeats: number,
 *   repeatUnit: "measures" | "beats",
 *   repeatEvery: number | null,
 *   repeatEveryMeasuresMemory: number | null,
 *   repeatEveryBeatsMemory: number | null,
 *   repeatEndMeasure: number | null,
 *   notes: LoopNote[]
 * }} LayerLoop
 * spanBeats = length in beats of the original loop content only (not expanded by repeats).
 * Per-note `octave` is the musical octave index for that pitch (see keyLayout.midiFromPitchClassAndOctave).
 */

/** Must match app composition beat ceiling (extend / master loop length). */
export const MAX_COMPOSITION_BEATS = 64;

export const LOOP_OCTAVE_MIN = 0;
export const LOOP_OCTAVE_MAX = 7;

export function clampLoopOctave(n) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) {
    return LOOP_OCTAVE_MIN;
  }
  return Math.min(Math.max(x, LOOP_OCTAVE_MIN), LOOP_OCTAVE_MAX);
}

/** Max measure index 1…N allowed for scheduling (64 beats ÷ meter). */
export function maxMeasuresCompositionLimit(beatsPerMeasure) {
  const bpm = Math.max(1, beatsPerMeasure);
  return Math.max(1, Math.floor(MAX_COMPOSITION_BEATS / bpm));
}

let loopIdSeq = 0;
export function defaultLoopOctaveForLayerId(id) {
  if (id === "B") {
    return 1;
  }
  if (id === "D") {
    return 2;
  }
  if (id === "E") {
    return 3;
  }
  return 4;
}

function normalizeLoopNote(raw, legacyOctave) {
  const pitchClass =
    ((Math.round(Number(raw.pitchClass)) % 12) + 12) % 12;
  const lb = Math.max(0, Math.floor(raw.localBeatIndex) || 0);
  const startInBeat = raw.startInBeat ?? 0;
  const lengthInBeat = raw.lengthInBeat ?? 1;
  const fallbackOct = clampLoopOctave(legacyOctave);
  const rawOct =
    typeof raw.octave === "number" && Number.isFinite(raw.octave)
      ? raw.octave
      : fallbackOct;
  return {
    pitchClass,
    localBeatIndex: lb,
    startInBeat,
    lengthInBeat,
    octave: clampOctaveForPitchClass(pitchClass, rawOct),
  };
}

/**
 * True if shifting every note by `delta` octaves (−1 / +1) would change at least one clamped stored octave.
 */
export function loopNotesCanShiftOctave(notes, delta, legacyLoopOctave = 3) {
  if (!Array.isArray(notes) || notes.length === 0) {
    return false;
  }
  const leg = clampLoopOctave(legacyLoopOctave);
  return notes.some((n) => {
    const pitchClass =
      ((Math.round(Number(n.pitchClass)) % 12) + 12) % 12;
    const o =
      typeof n.octave === "number" && Number.isFinite(n.octave)
        ? n.octave
        : leg;
    const next = clampOctaveForPitchClass(pitchClass, o + delta);
    return next !== o;
  });
}

/** Add `delta` (+1 / −1) to each note’s stored octave, clamped per pitch to MIDI range. */
export function shiftLoopNotesOctaveBy(notes, delta, legacyLoopOctave = 3) {
  const leg = clampLoopOctave(legacyLoopOctave);
  const d = Math.floor(Number(delta));
  if (!Number.isFinite(d) || d === 0) {
    return Array.isArray(notes) ? [...notes] : [];
  }
  return (Array.isArray(notes) ? notes : []).map((n) => {
    const pitchClass =
      ((Math.round(Number(n.pitchClass)) % 12) + 12) % 12;
    const o =
      typeof n.octave === "number" && Number.isFinite(n.octave)
        ? n.octave
        : leg;
    return {
      ...n,
      pitchClass,
      localBeatIndex: Math.max(0, Math.floor(n.localBeatIndex) || 0),
      startInBeat: n.startInBeat ?? 0,
      lengthInBeat: n.lengthInBeat ?? 1,
      octave: clampOctaveForPitchClass(pitchClass, o + d),
    };
  });
}

export function createDefaultLoop(overrides = {}) {
  loopIdSeq += 1;
  return {
    id: `loop-${loopIdSeq}`,
    startMeasure: 1,
    spanBeats: 1,
    repeatUnit: "measures",
    repeatEvery: null,
    repeatEveryMeasuresMemory: null,
    repeatEveryBeatsMemory: null,
    repeatEndMeasure: null,
    notes: [],
    ...overrides,
  };
}

export function normalizeRepeatUnit(value) {
  return value === "beats" ? "beats" : "measures";
}

export function maxRepeatEveryForUnit(unit, beatsPerMeasure) {
  if (unit === "beats") {
    return Math.max(1, Math.max(1, beatsPerMeasure) - 1);
  }
  return 8;
}

export function repeatIntervalBeats(repeatUnit, repeatEvery, beatsPerMeasure) {
  if (repeatEvery == null) {
    return null;
  }
  const every = Math.max(1, Math.floor(repeatEvery));
  const bpm = Math.max(1, beatsPerMeasure);
  return repeatUnit === "beats" ? every : every * bpm;
}

export function isRepeatDisabled(spanBeats, beatsPerMeasure, repeatUnit, repeatEvery) {
  const span = Math.max(1, Math.floor(spanBeats) || 1);
  const interval = repeatIntervalBeats(repeatUnit, repeatEvery, beatsPerMeasure);
  if (interval == null) {
    return false;
  }
  return interval < span;
}

function inferRepeatFromLegacy(loop, beatsPerMeasure) {
  const legacyMeasureRepeat = loop.repeatEveryMeasures;
  if (legacyMeasureRepeat != null) {
    return {
      repeatUnit: "measures",
      repeatEvery: Math.max(1, Math.floor(legacyMeasureRepeat)),
    };
  }
  const legacyBeats = Array.isArray(loop.playBeatsInMeasure)
    ? [...new Set(loop.playBeatsInMeasure.map((n) => Math.floor(Number(n))))]
        .filter((n) => n >= 1 && n <= Math.max(1, beatsPerMeasure))
        .sort((a, b) => a - b)
    : [1];
  if (legacyBeats.length <= 1) {
    return { repeatUnit: "measures", repeatEvery: null };
  }
  const diffs = [];
  for (let i = 1; i < legacyBeats.length; i += 1) {
    diffs.push(legacyBeats[i] - legacyBeats[i - 1]);
  }
  const minDiff = Math.min(...diffs);
  return {
    repeatUnit: "beats",
    repeatEvery: Number.isFinite(minDiff) && minDiff > 0 ? minDiff : null,
  };
}

export function clampLoopToComposition(loop, beatsPerMeasure, totalMeasures) {
  const bpm = Math.max(1, beatsPerMeasure);
  const tm = Math.max(1, totalMeasures);
  const maxEndMeasure = maxMeasuresCompositionLimit(bpm);
  let startMeasure = Math.min(
    Math.max(1, Math.floor(loop.startMeasure) || 1),
    tm,
  );

  const legacyRepeat = inferRepeatFromLegacy(loop, bpm);
  let repeatUnit = normalizeRepeatUnit(loop.repeatUnit ?? legacyRepeat.repeatUnit);
  const maxEvery = maxRepeatEveryForUnit(repeatUnit, bpm);
  let repeatEveryRaw = loop.repeatEvery ?? legacyRepeat.repeatEvery;
  let repeatEvery =
    repeatEveryRaw == null
      ? null
      : Math.min(maxEvery, Math.max(1, Math.floor(repeatEveryRaw)));
  let repeatEveryMeasuresMemoryRaw =
    loop.repeatEveryMeasuresMemory ??
    (repeatUnit === "measures" ? repeatEvery : null);
  let repeatEveryBeatsMemoryRaw =
    loop.repeatEveryBeatsMemory ?? (repeatUnit === "beats" ? repeatEvery : null);
  let repeatEveryMeasuresMemory =
    repeatEveryMeasuresMemoryRaw == null
      ? null
      : Math.min(8, Math.max(1, Math.floor(repeatEveryMeasuresMemoryRaw)));
  let repeatEveryBeatsMemory =
    repeatEveryBeatsMemoryRaw == null
      ? null
      : Math.min(
          maxRepeatEveryForUnit("beats", bpm),
          Math.max(1, Math.floor(repeatEveryBeatsMemoryRaw)),
        );

  let repeatEndMeasure = loop.repeatEndMeasure;
  if (repeatEvery == null || repeatUnit === "beats") {
    repeatEndMeasure = null;
  } else if (repeatEndMeasure != null) {
    const minEnd = startMeasure + 1;
    repeatEndMeasure = Math.min(
      Math.max(minEnd, Math.floor(repeatEndMeasure)),
      maxEndMeasure,
    );
  }

  let spanBeats = Math.min(
    Math.max(1, Math.floor(loop.spanBeats) || 1),
    MAX_COMPOSITION_BEATS,
  );

  if (repeatEvery != null && isRepeatDisabled(spanBeats, bpm, repeatUnit, repeatEvery)) {
    const nextValid = [];
    for (let n = repeatEvery + 1; n <= maxEvery; n += 1) {
      if (!isRepeatDisabled(spanBeats, bpm, repeatUnit, n)) {
        nextValid.push(n);
      }
    }
    repeatEvery = nextValid[0] ?? null;
  }
  if (repeatEvery == null) {
    repeatEndMeasure = null;
  }
  if (
    repeatEveryMeasuresMemory != null &&
    isRepeatDisabled(spanBeats, bpm, "measures", repeatEveryMeasuresMemory)
  ) {
    repeatEveryMeasuresMemory = null;
  }
  if (
    repeatEveryBeatsMemory != null &&
    isRepeatDisabled(spanBeats, bpm, "beats", repeatEveryBeatsMemory)
  ) {
    repeatEveryBeatsMemory = null;
  }

  const legacyOct = clampLoopOctave(loop.octave ?? 3);
  const rawNotes = Array.isArray(loop.notes) ? loop.notes : [];
  const notes = rawNotes.map((n) => normalizeLoopNote(n, legacyOct));

  return {
    id: typeof loop.id === "string" ? loop.id : "loop",
    startMeasure,
    spanBeats,
    repeatUnit,
    repeatEvery,
    repeatEveryMeasuresMemory,
    repeatEveryBeatsMemory,
    repeatEndMeasure,
    notes,
  };
}

export function clampLoopsToMeasures(loops, beatsPerMeasure, totalMeasures) {
  return loops.map((l) =>
    clampLoopToComposition(l, beatsPerMeasure, totalMeasures),
  );
}
