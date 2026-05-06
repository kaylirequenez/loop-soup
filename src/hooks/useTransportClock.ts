import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMidiStore } from "../store/midiStore";
import { useTransportStore } from "../store/transportStore";
import { useCompositionStore } from "../store/compositionStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerStore } from "../store/layerStore";
import { wrapBeat, playheadMeasureIndex } from "../utils/midiTransport";
import { clamp } from "../utils";
import { compositionLoopBeatLength } from "../utils/compositionState";

/** Cap dt so a tab suspension or debugger pause doesn't produce a huge jump. */
const MAX_DT_MS = 250;

/**
 * Drives the composition playhead via requestAnimationFrame when isPlaying is true.
 * Restarts the loop whenever transportNonce changes (used to re-sync after a seek).
 *
 * On each tick:
 *   - Advances midiPlayheadBeat by the elapsed time at the current bpm.
 *   - Wraps the beat at the composition boundary.
 *   - Scrolls midiViewMeasureIndex so the playhead stays in the visible window.
 *   - Updates playheadPhase (0–1) for any consumers that need a normalized position.
 *
 * This hook produces no output and must be called once near the root of the tree
 * (currently in App). When audio scheduling is added, the tick function is the
 * correct place to enqueue Web Audio events with lookahead.
 */
export function useTransportClock() {
  const { isPlaying, transportNonce } = useTransportStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      transportNonce: s.transportNonce,
    })),
  );

  useEffect(() => {
    if (!isPlaying) return undefined;

    let rafId = 0;
    let lastT = performance.now();

    const tick = () => {
      if (!useTransportStore.getState().isPlaying) return;

      const now = performance.now();
      const dt = Math.min(now - lastT, MAX_DT_MS);
      lastT = now;

      const { meter, totalMeasures, bpm } = useCompositionStore.getState();
      const beatsPerMeasure = meter.beatsPerMeasure;
      const beatLength = compositionLoopBeatLength(
        totalMeasures,
        beatsPerMeasure,
      );
      const { midiPlayheadBeat, midiMeasuresVisible } = useMidiStore.getState();

      const msPerBeat = 60000 / clamp(bpm, 40, 240);
      const rawBeat = midiPlayheadBeat + dt / msPerBeat;

      if (rawBeat >= beatLength) {
        const es = useLayerEditorStore.getState();
        if (es.isRecordingLoop) {
          if (es.selectedLoopId !== null) {
            useLayerStore
              .getState()
              .finalizeLoop(es.selectedLayerId, es.selectedLoopId, beatLength);
          }
          es.stopRecording();
        }
      }

      const beat = wrapBeat(rawBeat, beatLength);

      const playheadIdx = playheadMeasureIndex(beat, beatsPerMeasure);
      const visible = Math.max(1, Math.min(midiMeasuresVisible, totalMeasures));
      const maxStart = Math.max(0, totalMeasures - visible);
      const midiViewMeasureIndex = Math.max(0, Math.min(maxStart, playheadIdx));

      useMidiStore.setState({ midiPlayheadBeat: beat, midiViewMeasureIndex });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, transportNonce]);
}
