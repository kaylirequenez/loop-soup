import { useTransportStore } from "../store/transportStore";
import { useCompositionStore } from "../store/compositionStore";

/**
 * Snaps the playhead to beat 0 of `viewMeasureIndex` and bumps the transport
 * nonce so active playback restarts from the new position. Reads composition
 * state fresh from stores at call time.
 *
 * This is the single entry point for both the BottomControls "restart view"
 * button and the MidiMeasureNav "⟲ now bar" button.
 *
 * @param viewMeasureIndex - 0-based measure to snap to; clamped to valid range.
 */
export function snapPlayheadToView(viewMeasureIndex: number): void {
  const { meter, totalMeasures } = useCompositionStore.getState();
  const targetMeasure = Math.max(
    0,
    Math.min(totalMeasures - 1, viewMeasureIndex),
  );
  useTransportStore.getState().setPlayheadBeat(targetMeasure * meter.beatsPerMeasure);
  useTransportStore.getState().bumpTransportNonce();
}

/**
 * 0-based measure index for a beat position.
 *
 * @param beat - Current playhead beat; should be in [0, beatLength) from wrapBeat.
 * @param beatsPerMeasure - Beats per measure from the composition meter.
 */
export function playheadMeasureIndex(
  beat: number,
  beatsPerMeasure: number,
): number {
  return Math.floor(beat / beatsPerMeasure);
}

/**
 * Wraps `beat` into [0, beatLength) with floating-point edge handling.
 *
 * @param beat - Raw beat value; may be negative or beyond beatLength.
 * @param beatLength - Total loop length in beats; clamped to a minimum of 1e-6.
 * @returns Wrapped beat in [0, beatLength - 1e-6]. Values within 1e-9 of
 *   beatLength snap to 0 to prevent float accumulation at the loop boundary.
 */
export function wrapBeat(beat: number, beatLength: number): number {
  const len = Math.max(1e-6, beatLength);
  let w = ((beat % len) + len) % len;
  if (w >= len - 1e-9) {
    w = 0;
  }
  return Math.min(Math.max(0, w), len - 1e-6);
}
