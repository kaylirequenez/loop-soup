import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { getContext as getToneContext, getTransport } from "tone";
import { useMidiStore } from "../store/midiStore";
import { useTransportStore } from "../store/transportStore";
import { useCompositionStore } from "../store/compositionStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerStore } from "../store/layerStore";
import { wrapBeat, playheadMeasureIndex } from "../utils/midiTransport";
import { loopTimeline } from "../utils/loopTimeline";
import { clamp } from "../utils";
import { compositionLoopBeatLength } from "../utils/compositionState";
import { audioEngine } from "../audio/audioEngine";

const MAX_AUDIO_DT = 0.25;

export function useTransportClock() {
  const { isPlaying, transportNonce } = useTransportStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      transportNonce: s.transportNonce,
    })),
  );

  useEffect(() => {
    if (!isPlaying) return undefined;

    const { bpm } = useCompositionStore.getState();
    const transport = getTransport();
    transport.bpm.value = clamp(bpm, 40, 240);
    transport.start();

    let lastAudioSeconds = transport.seconds;
    let currentBeat = useTransportStore.getState().playheadBeat;
    let rafId = 0;

    const tick = () => {
      if (!useTransportStore.getState().isPlaying) return;

      const audioNow = transport.seconds;
      const dt = Math.max(0, Math.min(audioNow - lastAudioSeconds, MAX_AUDIO_DT));
      lastAudioSeconds = audioNow;

      const { meter, totalMeasures, bpm } = useCompositionStore.getState();
      const beatsPerMeasure = meter.beatsPerMeasure;
      const beatLength = compositionLoopBeatLength(totalMeasures, beatsPerMeasure);
      transport.bpm.value = clamp(bpm, 40, 240);
      const bps = clamp(bpm, 40, 240) / 60;

      const rawBeat = currentBeat + dt * bps;

      const wrapping = rawBeat >= beatLength;
      if (wrapping) {
        const es = useLayerEditorStore.getState();
        if (es.isRecordingLoop) {
          if (es.selectedLoopId !== null) {
            useLayerStore
              .getState()
              .finalizeLoop(es.selectedLayerId, es.selectedLoopId, beatLength);
          }
          es.stopRecording();
        }
        audioEngine.cancelAll();
      }

      currentBeat = wrapBeat(rawBeat, beatLength);

      audioEngine.scheduleLookahead(
        currentBeat,
        getToneContext().currentTime,
        bps,
        useLayerStore.getState().layers,
        (layerId, loopId) => loopTimeline.getNotesForLoop(layerId, loopId),
      );

      const { midiMeasuresVisible } = useMidiStore.getState();
      const playheadIdx = playheadMeasureIndex(currentBeat, beatsPerMeasure);
      const visible = Math.max(1, Math.min(midiMeasuresVisible, totalMeasures));
      const maxStart = Math.max(0, totalMeasures - visible);
      const viewMeasureIndex = Math.max(0, Math.min(maxStart, playheadIdx));

      useTransportStore.setState({ playheadBeat: currentBeat, viewMeasureIndex });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      transport.stop();
    };
  }, [isPlaying, transportNonce]);
}
