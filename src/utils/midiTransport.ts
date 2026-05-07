import { getContext, getTransport, immediate } from "tone";
import { useTransportStore } from "../store/transportStore";
import { useCompositionStore } from "../store/compositionStore";
import { audioEngine } from "../audio/audioEngine";
import { transportDebug } from "./transportDebug";

export function transportBeat(): number {
  const transport = getTransport();
  const context = getContext();
  const rawContext = context.rawContext as { outputLatency?: number };
  const outputLatency = rawContext.outputLatency ?? 0;
  const audibleTime = Math.max(0, immediate() - outputLatency);
  const beat = transport.getTicksAtTime(audibleTime) / transport.PPQ;
  transportDebug("transportBeat()", {
    ticks: transport.ticks,
    beat,
    audibleTime,
    outputLatency,
    state: transport.state,
  });
  return beat;
}

export function seekTransportBeat(targetBeat: number): void {
  const transport = getTransport();
  const fromTicks = transport.ticks;
  transport.ticks = Math.round(targetBeat * transport.PPQ);
  transportDebug("seekTransportBeat", {
    targetBeat,
    fromTicks,
    toTicks: transport.ticks,
    state: transport.state,
  });
  useTransportStore.getState().setPlayheadBeat(targetBeat);
}

/**
 * Snaps the playhead to beat 0 of `viewMeasureIndex`.
 * Reads composition state fresh from stores at call time.
 *
 * This is the single entry point for both the BottomControls "restart view"
 * button and the MidiMeasureNav "⟲ now bar" button.
 *
 * @param viewMeasureIndex - 0-based measure to snap to; clamped to valid range.
 */
export function snapPlayheadToView(viewMeasureIndex: number): void {
  const { meter, totalMeasures } = useCompositionStore.getState();
  const targetMeasure = Math.max(0, Math.min(totalMeasures - 1, viewMeasureIndex));
  const targetBeat = targetMeasure * meter.beatsPerMeasure;
  transportDebug("snapPlayheadToView", {
    viewMeasureIndex,
    targetMeasure,
    targetBeat,
  });
  // Set Transport.ticks directly so a mid-playback seek takes effect immediately.
  seekTransportBeat(targetBeat);
  audioEngine.cancelAll();
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
