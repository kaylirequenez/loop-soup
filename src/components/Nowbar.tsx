interface NowbarProps {
  /** Current playhead position in beats (composition-global). */
  beat: number;
  /** Beat at the left edge of the visible window (inclusive). */
  startBeat: number;
  /** Beat at the right edge of the visible window (exclusive). */
  endBeat: number;
  /** CSS class applied to the bar element. */
  className: string;
}

/**
 * Horizontal playhead bar rendered at a percentage within a beat window.
 *
 * @param beat - Playhead position in beats; must be in [startBeat, endBeat) to render.
 * @param startBeat - Beat at the left edge of the visible area.
 * @param endBeat - Beat at the right edge of the visible area (exclusive).
 * @param className - CSS class controlling appearance and positioning context.
 * @returns A div at left = (beat - startBeat) / (endBeat - startBeat) * 100%,
 *   or null when beat is outside the window.
 */
export function Nowbar({
  beat,
  startBeat,
  endBeat,
  className,
}: NowbarProps) {
  if (beat < startBeat || beat >= endBeat) return null;
  const pct = ((beat - startBeat) / (endBeat - startBeat)) * 100;
  return (
    <div className={className} style={{ left: `${pct}%` }} />
  );
}
