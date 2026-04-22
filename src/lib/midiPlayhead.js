/**
 * MIDI roll “now” position: fractional beat index within the shared composition timeline.
 */

export function beatsPerMeasureFromMeter(meter) {
  const n = Number.parseInt(String(meter).split("/")[0], 10);
  return n > 0 ? n : 4;
}

/** Total loop length in beats for the shared composition timeline (extend / transport / MIDI roll). */
export function compositionLoopBeatLength(masterLoopLength, beatsPerMeasure) {
  return Math.max(
    1,
    Number(masterLoopLength) > 0 ? masterLoopLength : beatsPerMeasure,
  );
}

/** Phrase length in beats for the layer’s active loop (`loops[].spanBeats`). */
export function layerLoopBeatLength(layer, beatsPerMeasure) {
  const loops = layer?.loops;
  const ai = Math.max(
    0,
    Math.min((loops?.length ?? 1) - 1, layer?.activeLoopIndex ?? 0),
  );
  const span = Number(loops?.[ai]?.spanBeats);
  return Math.max(
    1,
    Number.isFinite(span) && span > 0 ? span : beatsPerMeasure,
  );
}

/** Single shared composition playhead (not per layer). */
export function readMidiCompositionBeat(midiPlayheadBeat, beatLength) {
  const raw = Number(midiPlayheadBeat) || 0;
  return Math.min(Math.max(0, raw), beatLength - 1e-6);
}

/**
 * Scroll the MIDI roll window so the playhead’s measure stays visible.
 * @param {number} playheadMeasureIdx - 0-based measure containing the playhead
 * @param {number} measureCount - total measures in the layer loop
 * @param {number} visibleMeasures - how many measures fit in the viewport (>=1)
 * @param {number} prevWindowStart - current first visible measure index
 */
export function midiViewWindowStartForPlayhead(
  playheadMeasureIdx,
  measureCount,
  visibleMeasures,
  prevWindowStart,
) {
  const visible = Math.max(1, Math.min(visibleMeasures, measureCount));
  const maxStart = Math.max(0, measureCount - visible);
  const p = Math.min(measureCount - 1, Math.max(0, playheadMeasureIdx));
  let start = Math.max(0, Math.min(maxStart, prevWindowStart));
  if (p < start) {
    start = p;
  } else if (p >= start + visible) {
    start = p - visible + 1;
  }
  return Math.max(0, Math.min(maxStart, start));
}
