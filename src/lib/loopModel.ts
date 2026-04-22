import { clampOctaveForPitchClass } from "./keyLayout";
import type { LayerId, LayerLoop, LoopNote } from "../types/model";

/** Must match app composition beat ceiling (extend / master loop length). */
export const MAX_COMPOSITION_BEATS = 64;

export const LOOP_OCTAVE_MIN = 0;
export const LOOP_OCTAVE_MAX = 7;

export function clampLoopOctave(n: unknown): number {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) {
    return LOOP_OCTAVE_MIN;
  }
  return Math.min(Math.max(x, LOOP_OCTAVE_MIN), LOOP_OCTAVE_MAX);
}

/** Max measure index 1…N allowed for scheduling (64 beats ÷ meter). */
export function maxMeasuresCompositionLimit(beatsPerMeasure: number): number {
  const bpm = Math.max(1, beatsPerMeasure);
  return Math.max(1, Math.floor(MAX_COMPOSITION_BEATS / bpm));
}

let loopIdSeq = 0;

export function defaultLoopOctaveForLayerId(id: LayerId): number {
  if (id === "B") return 1;
  if (id === "D") return 2;
  if (id === "E") return 3;
  return 4;
}

function normalizeLoopNote(
  raw: Record<string, unknown>,
  legacyOctave: number,
): LoopNote {
  const pitchClass =
    ((Math.round(Number(raw.pitchClass)) % 12) + 12) % 12;
  const lb = Math.max(0, Math.floor(Number(raw.localBeatIndex)) || 0);
  const startInBeat = (raw.startInBeat as number) ?? 0;
  const lengthInBeat = (raw.lengthInBeat as number) ?? 1;
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
export function loopNotesCanShiftOctave(
  notes: LoopNote[],
  delta: number,
  legacyLoopOctave = 3,
): boolean {
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

/** Add `delta` (+1 / −1) to each note's stored octave, clamped per pitch to MIDI range. */
export function shiftLoopNotesOctaveBy(
  notes: LoopNote[],
  delta: number,
  legacyLoopOctave = 3,
): LoopNote[] {
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

export function createDefaultLoop(overrides: Partial<LayerLoop> = {}): LayerLoop {
  loopIdSeq += 1;
  return {
    id: `loop-${loopIdSeq}`,
    startMeasure: 1,
    spanBeats: 1,
    repeatUnit: "measures",
    repeatEveryMeasuresMemory: null,
    repeatEveryBeatsMemory: null,
    repeatEndMeasure: null,
    notes: [],
    ...overrides,
  };
}

export function normalizeRepeatUnit(value: unknown): "measures" | "beats" {
  return value === "beats" ? "beats" : "measures";
}

export function maxRepeatEveryForUnit(
  unit: "measures" | "beats",
  beatsPerMeasure: number,
): number {
  if (unit === "beats") {
    return Math.max(1, Math.max(1, beatsPerMeasure) - 1);
  }
  return 8;
}

export function repeatEveryForUnit(
  loop: Pick<LayerLoop, "repeatUnit" | "repeatEveryMeasuresMemory" | "repeatEveryBeatsMemory">,
): number | null {
  const unit = normalizeRepeatUnit(loop?.repeatUnit);
  if (unit === "measures") {
    return loop?.repeatEveryMeasuresMemory ?? null;
  }
  return loop?.repeatEveryBeatsMemory ?? null;
}

export function repeatIntervalBeats(
  repeatUnit: "measures" | "beats",
  repeatEvery: number | null | undefined,
  beatsPerMeasure: number,
): number | null {
  if (repeatEvery == null) {
    return null;
  }
  const every = Math.max(1, Math.floor(repeatEvery));
  const bpm = Math.max(1, beatsPerMeasure);
  return repeatUnit === "beats" ? every : every * bpm;
}

export function isRepeatDisabled(
  spanBeats: number,
  beatsPerMeasure: number,
  repeatUnit: "measures" | "beats",
  repeatEvery: number | null | undefined,
): boolean {
  const span = Math.max(1, Math.floor(spanBeats) || 1);
  const interval = repeatIntervalBeats(repeatUnit, repeatEvery, beatsPerMeasure);
  if (interval == null) {
    return false;
  }
  return interval < span;
}

/** Legacy loop shape from older persisted state. */
interface RawLoop extends Record<string, unknown> {
  repeatUnit?: unknown;
  repeatEveryMeasuresMemory?: unknown;
  repeatEveryBeatsMemory?: unknown;
  repeatEveryMeasures?: unknown;
  playBeatsInMeasure?: unknown;
  repeatEvery?: unknown;
  repeatEndMeasure?: unknown;
  startMeasure?: unknown;
  spanBeats?: unknown;
  notes?: unknown;
  id?: unknown;
  octave?: unknown;
}

function inferRepeatFromLegacy(
  loop: RawLoop,
  beatsPerMeasure: number,
): { repeatUnit: "measures" | "beats"; repeatEvery: number | null } {
  const legacyMeasureRepeat = loop.repeatEveryMeasures;
  if (legacyMeasureRepeat != null) {
    return {
      repeatUnit: "measures",
      repeatEvery: Math.max(1, Math.floor(Number(legacyMeasureRepeat))),
    };
  }
  const legacyBeats = Array.isArray(loop.playBeatsInMeasure)
    ? [...new Set((loop.playBeatsInMeasure as unknown[]).map((n) => Math.floor(Number(n))))]
        .filter((n) => n >= 1 && n <= Math.max(1, beatsPerMeasure))
        .sort((a, b) => a - b)
    : [1];
  if (legacyBeats.length <= 1) {
    return { repeatUnit: "measures", repeatEvery: null };
  }
  const diffs: number[] = [];
  for (let i = 1; i < legacyBeats.length; i += 1) {
    diffs.push(legacyBeats[i] - legacyBeats[i - 1]);
  }
  const minDiff = Math.min(...diffs);
  return {
    repeatUnit: "beats",
    repeatEvery: Number.isFinite(minDiff) && minDiff > 0 ? minDiff : null,
  };
}

export function clampLoopToComposition(
  loop: RawLoop,
  beatsPerMeasure: number,
  totalMeasures: number,
): LayerLoop {
  const bpm = Math.max(1, beatsPerMeasure);
  const tm = Math.max(1, totalMeasures);
  const maxEndMeasure = maxMeasuresCompositionLimit(bpm);
  let startMeasure = Math.min(
    Math.max(1, Math.floor(Number(loop.startMeasure)) || 1),
    tm,
  );

  const legacyRepeat = inferRepeatFromLegacy(loop, bpm);
  let repeatUnit = normalizeRepeatUnit(loop.repeatUnit ?? legacyRepeat.repeatUnit);
  const legacyRepeatEvery =
    loop.repeatEvery == null ? legacyRepeat.repeatEvery : Number(loop.repeatEvery);
  let repeatEveryMeasuresMemoryRaw =
    (loop.repeatEveryMeasuresMemory as number | null) ??
    (repeatUnit === "measures" ? legacyRepeatEvery : null) ??
    (legacyRepeat.repeatUnit === "measures" ? legacyRepeat.repeatEvery : null);
  let repeatEveryBeatsMemoryRaw =
    (loop.repeatEveryBeatsMemory as number | null) ??
    (repeatUnit === "beats" ? legacyRepeatEvery : null) ??
    (legacyRepeat.repeatUnit === "beats" ? legacyRepeat.repeatEvery : null);
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

  const setSelectedRepeatEvery = (value: number | null) => {
    if (repeatUnit === "measures") {
      repeatEveryMeasuresMemory = value;
    } else {
      repeatEveryBeatsMemory = value;
    }
  };
  let repeatEvery = repeatEveryForUnit({
    repeatUnit,
    repeatEveryMeasuresMemory,
    repeatEveryBeatsMemory,
  });
  const maxEvery = maxRepeatEveryForUnit(repeatUnit, bpm);
  if (repeatEvery != null) {
    repeatEvery = Math.min(maxEvery, Math.max(1, Math.floor(repeatEvery)));
    setSelectedRepeatEvery(repeatEvery);
  }

  let repeatEndMeasure: number | null =
    loop.repeatEndMeasure != null ? Number(loop.repeatEndMeasure) : null;
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
    Math.max(1, Math.floor(Number(loop.spanBeats)) || 1),
    MAX_COMPOSITION_BEATS,
  );

  if (
    repeatEvery != null &&
    isRepeatDisabled(spanBeats, bpm, repeatUnit, repeatEvery)
  ) {
    const nextValid: number[] = [];
    for (let n = repeatEvery + 1; n <= maxEvery; n += 1) {
      if (!isRepeatDisabled(spanBeats, bpm, repeatUnit, n)) {
        nextValid.push(n);
      }
    }
    repeatEvery = nextValid[0] ?? null;
    setSelectedRepeatEvery(repeatEvery);
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
  const notes = (rawNotes as Record<string, unknown>[]).map((n) =>
    normalizeLoopNote(n, legacyOct),
  );

  return {
    id: typeof loop.id === "string" ? loop.id : "loop",
    startMeasure,
    spanBeats,
    repeatUnit,
    repeatEveryMeasuresMemory,
    repeatEveryBeatsMemory,
    repeatEndMeasure,
    notes,
  };
}

export function clampLoopsToMeasures(
  loops: RawLoop[],
  beatsPerMeasure: number,
  totalMeasures: number,
): LayerLoop[] {
  return loops.map((l) => clampLoopToComposition(l, beatsPerMeasure, totalMeasures));
}
