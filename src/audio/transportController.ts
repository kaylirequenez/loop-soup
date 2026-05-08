import { getTransport } from "tone";
import type { Meter } from "../types/composition";
import { clamp } from "../utils";
import { useTransportStore } from "../store/transportStore";
import { useCompositionStore } from "../store/compositionStore";
import { audioEngine } from "./audioEngine";

const TRANSPORT_START_LEAD_SECONDS = 0.05;

export function applyTransportConfig(
  bpm: number,
  meter: Meter,
  totalMeasures: number,
): void {
  const transport = getTransport();
  const loopStartPosition = "0:0:0";
  const loopEndPosition = `${totalMeasures}:0:0`;
  transport.bpm.value = clamp(bpm, 40, 240);
  transport.timeSignature = [meter.beatsPerMeasure, meter.noteValue];
  transport.loopStart = loopStartPosition;
  transport.loopEnd = loopEndPosition;
}

export function seekTransportBeat(targetBeat: number): void {
  const transport = getTransport();
  transport.ticks = Math.round(targetBeat * transport.PPQ);
  useTransportStore.getState().setPlayheadBeat(targetBeat);
}

export function seekTransportBeatAndPanic(targetBeat: number): void {
  seekTransportBeat(targetBeat);
  audioEngine.cancelAll();
}

/**
 * Relocate playhead while already playing, then re-arm Transport with lead time
 * so downbeat events at the seek target are not dropped.
 */
export function restartPlaybackFromBeat(targetBeat: number): void {
  const transport = getTransport();
  transport.pause();
  seekTransportBeatAndPanic(targetBeat);
  transport.loop = true;
  transport.start(`+${TRANSPORT_START_LEAD_SECONDS}`);
}

/**
 * Snaps playhead to beat 0 of a provided measure index, then clears held tails.
 */
export function snapPlayheadToMeasureStart(viewMeasureIndex: number): void {
  const { meter, totalMeasures } = useCompositionStore.getState();
  const targetMeasure = Math.max(
    0,
    Math.min(totalMeasures - 1, viewMeasureIndex),
  );
  const targetBeat = targetMeasure * meter.beatsPerMeasure;
  seekTransportBeatAndPanic(targetBeat);
}

/** Prepares looping session state before Transport.start(). */
export function primePlaybackSession(startBeat: number): void {
  const transport = getTransport();
  seekTransportBeat(startBeat);
  transport.loop = true;
}

export function startPlaybackSession(): void {
  const transport = getTransport();
  transport.start(`+${TRANSPORT_START_LEAD_SECONDS}`);
}

/**
 * Pause transport during a scrub gesture without touching store-level play state.
 * Returns whether transport was running before pause.
 */
export function pauseForScrub(): boolean {
  const transport = getTransport();
  if (transport.state !== "started") return false;
  transport.pause();
  return true;
}

/**
 * Resume transport after scrub from the dragged beat.
 */
export function resumeAfterScrub(startBeat: number): void {
  const transport = getTransport();
  seekTransportBeat(startBeat);
  transport.loop = true;
  transport.start(`+${TRANSPORT_START_LEAD_SECONDS}`);
}

/** Stops session while preserving current playhead position. */
export function stopPlaybackSession(): void {
  const transport = getTransport();
  transport.pause();
  transport.loop = false;
}

export function attachLoopHandler(onLoop: () => void): () => void {
  const transport = getTransport();
  transport.on("loop", onLoop);
  return () => transport.off("loop", onLoop);
}
