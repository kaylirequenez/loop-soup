const EPS = 1e-9;
const MIN_NOTE_BEAT_LEN = 0.05;

export function clampDraggedIntervalToBounds(startBeat, endBeat, bounds) {
  let s = Math.max(bounds.startBeat, startBeat);
  let e = Math.min(bounds.endBeat, endBeat);
  if (e - s < MIN_NOTE_BEAT_LEN) {
    if (s <= bounds.startBeat + EPS) {
      e = Math.min(bounds.endBeat, bounds.startBeat + MIN_NOTE_BEAT_LEN);
    } else {
      s = Math.max(bounds.startBeat, bounds.endBeat - MIN_NOTE_BEAT_LEN);
      e = bounds.endBeat;
    }
  }
  return { startBeat: s, endBeat: e };
}

export function mergeOverlapRanges(ranges) {
  const out = [];
  const sorted = [...(Array.isArray(ranges) ? ranges : [])]
    .map((r) => ({
      startBeat: Number(r?.startBeat),
      endBeat: Number(r?.endBeat),
    }))
    .filter((r) => Number.isFinite(r.startBeat) && Number.isFinite(r.endBeat))
    .map((r) => ({
      startBeat: Math.min(r.startBeat, r.endBeat),
      endBeat: Math.max(r.startBeat, r.endBeat),
    }))
    .filter((r) => r.endBeat - r.startBeat > EPS)
    .sort((a, b) => a.startBeat - b.startBeat);
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (!last || r.startBeat > last.endBeat + EPS) {
      out.push({ ...r });
    } else {
      last.endBeat = Math.max(last.endBeat, r.endBeat);
    }
  }
  return out;
}

export function subtractOverlapRanges(startBeat, endBeat, overlapRanges) {
  const s = Math.min(startBeat, endBeat);
  const e = Math.max(startBeat, endBeat);
  if (e - s <= EPS) {
    return [];
  }
  const merged = mergeOverlapRanges(overlapRanges)
    .map((r) => ({
      startBeat: Math.max(s, r.startBeat),
      endBeat: Math.min(e, r.endBeat),
    }))
    .filter((r) => r.endBeat - r.startBeat > EPS);
  let cursor = s;
  const out = [];
  for (const r of merged) {
    if (r.endBeat <= cursor + EPS) {
      continue;
    }
    if (r.startBeat > cursor + EPS) {
      out.push({ startBeat: cursor, endBeat: r.startBeat });
    }
    cursor = Math.max(cursor, r.endBeat);
  }
  if (cursor < e - EPS) {
    out.push({ startBeat: cursor, endBeat: e });
  }
  return out.filter((seg) => seg.endBeat - seg.startBeat >= MIN_NOTE_BEAT_LEN - EPS);
}
