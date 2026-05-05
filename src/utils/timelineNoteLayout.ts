/**
 * Purpose:
 * Shared math for rendering `TimelineExpandedNote` rows (composition strip + MIDI roll).
 */

import type { TimelineExpandedNote } from "../types/timeline";

/** Horizontal placement as fractions of composition length ([0,1]). */
export interface TimelineNoteFractionRect {
  leftFract: number;
  widthFract: number;
}

export const TIMELINE_NOTE_MIN_WIDTH_FRACT = 0.002;

/** Minimum display width for an open (currently recording) note, in beats. */
const OPEN_NOTE_MIN_DISPLAY_BEATS = 0.25;

/**
 * Purpose:
 * Effective note end on the composition timeline.
 *
 * Behavior:
 * - Closed notes clamp to composition length.
 * - Open notes (`absoluteEndBeat == null`) extend to `midiPlayheadBeat`, with a
 *   minimum of `OPEN_NOTE_MIN_DISPLAY_BEATS` so the note is visible on press.
 */
export function resolveTimelineNoteEndBeat(
  absoluteStartBeat: number,
  absoluteEndBeat: number | null,
  midiPlayheadBeat: number,
  compositionEndBeat: number,
): number {
  const cap = compositionEndBeat;
  if (absoluteEndBeat != null) {
    return Math.min(cap, absoluteEndBeat);
  }
  return Math.min(
    cap,
    Math.max(absoluteStartBeat + OPEN_NOTE_MIN_DISPLAY_BEATS, midiPlayheadBeat),
  );
}

import type { LoopInstanceId, LayerLoopInstance } from "../types/layer";

export interface InstanceSpan {
  startBeat: number;
  endBeat: number;
}

/**
 * Purpose:
 * Compute the discrete beat span for each instance in a loop from its expanded
 * timeline notes. Groups by instanceId, finds the ceiled max absoluteEndBeat,
 * and pairs it with instance.startBeat.
 *
 * Skips instances with no closed notes or with startBeat < 0.
 */
export function loopInstanceSpans(
  notes: ReadonlyArray<TimelineExpandedNote>,
  instances: Record<LoopInstanceId, LayerLoopInstance>,
): InstanceSpan[] {
  const maxEndByInstance = new Map<LoopInstanceId, number>();
  for (const note of notes) {
    if (note.absoluteEndBeat == null) continue;
    const prev = maxEndByInstance.get(note.instanceId);
    if (prev == null || note.absoluteEndBeat > prev) {
      maxEndByInstance.set(note.instanceId, note.absoluteEndBeat);
    }
  }
  const spans: InstanceSpan[] = [];
  for (const [instanceId, maxEnd] of maxEndByInstance) {
    const inst = instances[instanceId];
    if (!inst || inst.startBeat < 0) continue;
    spans.push({ startBeat: inst.startBeat, endBeat: Math.ceil(maxEnd) });
  }
  return spans;
}

/**
 * Purpose:
 * Left edge and width as fractions of full composition length for CSS `%` positioning.
 */
export function timelineNoteFractionRect(
  absoluteStartBeat: number,
  resolvedEndBeat: number,
  compositionEndBeat: number,
): TimelineNoteFractionRect {
  const denom = Math.max(compositionEndBeat, 1e-9);
  const rawW = (resolvedEndBeat - absoluteStartBeat) / denom;
  return {
    leftFract: absoluteStartBeat / denom,
    widthFract: Math.max(rawW, TIMELINE_NOTE_MIN_WIDTH_FRACT),
  };
}
