/**
 * Lay out MIDI-roll note blocks in one measure: horizontal extent = time within the bar;
 * when several layers overlap in time on the same pitch, split row height among them.
 */

const EPS = 1e-5;
const ROWS = 12;
/** Fraction of the roll height for one pitch row (matches MidiRoll). */
const ROW_H_PCT = 100 / ROWS;
/** Breathing room between stacked notes inside a row (percent of roll). */
const STACK_GAP_PCT = 0.06;

export interface NoteSpanInput {
  layer: string;
  pitchClass: number;
  rowIndex: number;
  beatIndex: number;
  loopIndex?: number;
  loopId?: string;
  noteKey?: string;
  baseNoteKey?: string;
  noteIndex?: number;
  instanceOffset?: number;
  storedOctave?: number;
  startInBeat?: number;
  lengthInBeat?: number;
  globalStart?: number;
  globalEnd?: number;
}

export interface NoteRect {
  layer: string;
  pitchClass: number;
  rowIndex: number;
  leftPct: number;
  widthPct: number;
  topPct: number;
  heightPct: number;
  loopIndex?: number;
  loopId?: string;
  noteKey?: string;
  baseNoteKey?: string;
  noteIndex?: number;
  instanceOffset?: number;
  globalStart?: number;
  globalEnd?: number;
  sliceT0?: number;
  sliceT1?: number;
  storedOctave?: number;
  overlapCount: number;
  overlapIndex: number;
}

interface BeatInterval {
  note: NoteSpanInput;
  t0: number;
  t1: number;
}

function toMeasureBeatInterval(
  note: NoteSpanInput,
  beatsPerMeasure: number,
): BeatInterval | null {
  const startInBeat = note.startInBeat ?? 0;
  const lengthInBeat = note.lengthInBeat ?? 1;
  const beatInMeasure = note.beatIndex % beatsPerMeasure;
  let t0 = beatInMeasure + startInBeat;
  let t1 = t0 + lengthInBeat;
  t0 = Math.max(0, Math.min(beatsPerMeasure, t0));
  t1 = Math.max(0, Math.min(beatsPerMeasure, t1));
  if (t1 <= t0 + EPS) {
    return null;
  }
  return { note, t0, t1 };
}

function rectsForPitchClass(
  intervals: BeatInterval[],
  beatsPerMeasure: number,
): NoteRect[] {
  if (intervals.length === 0) {
    return [];
  }

  const boundaries = new Set<number>();
  for (const { t0, t1 } of intervals) {
    boundaries.add(t0);
    boundaries.add(t1);
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const out: NoteRect[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (b - a <= EPS) {
      continue;
    }

    const active = intervals.filter(
      ({ t0, t1 }) => t0 < b - EPS && t1 > a + EPS,
    );
    if (active.length === 0) {
      continue;
    }

    active.sort((x, y) => x.note.layer.localeCompare(y.note.layer));
    const k = active.length;
    const innerH = (ROW_H_PCT - STACK_GAP_PCT) / k;

    active.forEach((item, rank) => {
      const { note } = item;
      out.push({
        layer: note.layer,
        pitchClass: note.pitchClass,
        rowIndex: note.rowIndex,
        leftPct: (a / beatsPerMeasure) * 100,
        widthPct: ((b - a) / beatsPerMeasure) * 100,
        topPct: (note.rowIndex / ROWS) * 100 + rank * innerH + STACK_GAP_PCT * 0.25,
        heightPct: innerH - STACK_GAP_PCT * 0.5,
        loopIndex: note.loopIndex ?? 0,
        loopId: note.loopId,
        noteKey: note.noteKey,
        baseNoteKey: note.baseNoteKey,
        noteIndex: note.noteIndex,
        instanceOffset: note.instanceOffset ?? 0,
        globalStart: note.globalStart,
        globalEnd: note.globalEnd,
        sliceT0: a,
        sliceT1: b,
        storedOctave: note.storedOctave,
        overlapCount: k,
        overlapIndex: rank,
      });
    });
  }

  return out;
}

export function buildOverlapHeightStackRects(
  notes: NoteSpanInput[],
  beatsPerMeasure: number,
): NoteRect[] {
  const byRow = new Map<number, BeatInterval[]>();
  for (const note of notes) {
    const iv = toMeasureBeatInterval(note, beatsPerMeasure);
    if (!iv) {
      continue;
    }
    const row = note.rowIndex ?? 0;
    if (!byRow.has(row)) {
      byRow.set(row, []);
    }
    byRow.get(row)!.push(iv);
  }

  const rects: NoteRect[] = [];
  for (const intervals of byRow.values()) {
    rects.push(...rectsForPitchClass(intervals, beatsPerMeasure));
  }
  return rects;
}
