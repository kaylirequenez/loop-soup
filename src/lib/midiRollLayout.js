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

/**
 * @typedef {object} NoteSpanInput
 * @property {string} layer
 * @property {number} pitchClass
 * @property {number} rowIndex
 * @property {number} beatIndex - 0-based index within the layer loop
 * @property {number} [loopIndex] - which loop in the layer (default 0)
 * @property {string} [loopId]
 * @property {string} [noteKey] - stable id for selection / hit-testing
 * @property {string} [baseNoteKey] - per-loop note id for selection (layer-loop-index)
 * @property {number} [noteIndex] - index in loop.notes[]
 * @property {number} [instanceOffset] - repeat tiling offset (beats)
 * @property {number} [storedOctave] - per-note octave for UI badges
 * @property {number} [startInBeat] - 0…1, start offset inside the beat (default 0)
 * @property {number} [lengthInBeat] - length in beats, ≤ 1 - startInBeat (default 1)
 */

/**
 * @typedef {object} NoteRect
 * @property {string} layer
 * @property {number} pitchClass
 * @property {number} rowIndex
 * @property {number} leftPct
 * @property {number} widthPct
 * @property {number} topPct
 * @property {number} heightPct
 * @property {number} [loopIndex]
 * @property {string} [loopId]
 * @property {string} [noteKey]
 * @property {string} [baseNoteKey]
 * @property {number} [noteIndex]
 * @property {number} [instanceOffset]
 * @property {number} [globalStart]
 * @property {number} [globalEnd]
 * @property {number} [sliceT0] - measure-local start beat for this rect slice
 * @property {number} [sliceT1] - measure-local end beat (exclusive)
 * @property {number} [storedOctave]
 * @property {number} overlapCount - notes sharing this row & time slice
 * @property {number} overlapIndex - 0…overlapCount−1 within the stack
 */

/**
 * Convert each visible note to [t0,t1) in measure-local beat coordinates [0, beatsPerMeasure].
 */
function toMeasureBeatInterval(note, beatsPerMeasure) {
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

/**
 * For one pitch class, sweep critical times and emit stacked rects per time slice.
 */
function rectsForPitchClass(intervals, beatsPerMeasure) {
  if (intervals.length === 0) {
    return [];
  }

  const boundaries = new Set();
  for (const { t0, t1 } of intervals) {
    boundaries.add(t0);
    boundaries.add(t1);
  }
  const sorted = [...boundaries].sort((a, b) => a - b);
  const out = [];

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

/**
 * @param {NoteSpanInput[]} notes - already filtered to one measure & visible layers
 * @param {number} beatsPerMeasure
 * @returns {NoteRect[]}
 */
export function buildOverlapHeightStackRects(notes, beatsPerMeasure) {
  const byRow = new Map();
  for (const note of notes) {
    const iv = toMeasureBeatInterval(note, beatsPerMeasure);
    if (!iv) {
      continue;
    }
    const row = note.rowIndex ?? 0;
    if (!byRow.has(row)) {
      byRow.set(row, []);
    }
    byRow.get(row).push(iv);
  }

  const rects = [];
  for (const intervals of byRow.values()) {
    rects.push(...rectsForPitchClass(intervals, beatsPerMeasure));
  }
  return rects;
}
