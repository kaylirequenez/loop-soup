/**
 * Purpose:
 * Shared math for rendering `TimelineExpandedNote` rows (composition strip + MIDI roll).
 */

import type { TimelineNoteFractionRect } from "../types/timeline";

export type { TimelineNoteFractionRect };

export const TIMELINE_NOTE_MIN_WIDTH_FRACT = 0.002;

/** Minimum display width for an open (currently recording) note, in beats. */
const OPEN_NOTE_MIN_DISPLAY_BEATS = 0.25;

/**
 * Purpose:
 * Effective note end on the composition timeline.
 *
 * Behavior:
 * - Closed notes clamp to composition length.
 * - Open notes (`absoluteEndBeat == null`) extend to `playheadBeat`, with a
 *   minimum of `OPEN_NOTE_MIN_DISPLAY_BEATS` so the note is visible on press.
 */
export function resolveTimelineNoteEndBeat(
  absoluteStartBeat: number,
  absoluteEndBeat: number | null,
  playheadBeat: number,
  compositionEndBeat: number,
): number {
  const cap = compositionEndBeat;
  if (absoluteEndBeat != null) {
    return Math.min(cap, absoluteEndBeat);
  }
  return Math.min(
    cap,
    Math.max(absoluteStartBeat + OPEN_NOTE_MIN_DISPLAY_BEATS, playheadBeat),
  );
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
