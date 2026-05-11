import type { LoopNote } from "../types/layer";

interface PitchCurveOverlayProps {
  loopNote: LoopNote;
  color: string;
}

/** y fraction in SVG space (0=top, 1=bottom) for a semitone offset.
 *  ±1 semitone spans ±half the row height. Clamped to [0.05, 0.95]. */
function offsetToY(offset: number): number {
  return Math.max(0.05, Math.min(0.95, 0.5 - offset * 0.5));
}

export function PitchCurveOverlay({ loopNote, color }: PitchCurveOverlayProps) {
  const { pitchOffset, pitchPoints } = loopNote;
  const startOffset = pitchOffset ?? 0;
  const hasOffset = Math.abs(startOffset) > 0.005;
  const hasCurve = pitchPoints != null && pitchPoints.length > 0;

  if (!hasOffset && !hasCurve) return null;

  const startY = offsetToY(startOffset);

  // Build polyline points: start → each pitchPoint → end held at last value
  let points: string;
  if (hasCurve) {
    const pts = [`0,${startY}`];
    for (const pp of pitchPoints!) {
      const x = Math.max(0, Math.min(1, pp.beatOffset));
      pts.push(`${x},${offsetToY(startOffset + pp.offset)}`);
    }
    points = pts.join(" ");
  } else {
    points = `0,${startY} 1,${startY}`;
  }

  return (
    <svg
      className="pitch-curve-overlay"
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* faint center reference */}
      <line x1="0" y1="0.5" x2="1" y2="0.5" className="pco-center" />
      {/* pitch line/curve */}
      <polyline
        points={points}
        className="pco-curve"
        stroke={color}
      />
    </svg>
  );
}
