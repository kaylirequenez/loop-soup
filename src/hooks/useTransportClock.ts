import { useEffect } from "react";
import { useMidiStore } from "../store/midiStore";
import { useTransportStore } from "../store/transportStore";
import { useCompositionStore } from "../store/compositionStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerStore } from "../store/layerStore";
import {
  applyTransportConfig,
  attachLoopHandler,
  getTransportCursorSnapshot,
  getNowbarBeat,
  isTransportStarted,
  playheadMeasureIndex,
  primePlaybackSession,
} from "../audio/transportController";
import { compositionLoopBeatLength } from "../utils/compositionState";
import { audioEngine } from "../audio/audioEngine";

export function useTransportClock() {
  const isPlaying = useTransportStore((s) => s.isPlaying);

  useEffect(() => {
    const initial = useCompositionStore.getState();
    let lastBpm = initial.bpm;
    let lastMeter = initial.meter;
    let lastTotalMeasures = initial.totalMeasures;
    applyTransportConfig(lastBpm, lastMeter, lastTotalMeasures);

    const unsubComposition = useCompositionStore.subscribe((state) => {
      const nextBpm = state.bpm;
      const nextMeter = state.meter;
      const nextTotalMeasures = state.totalMeasures;
      if (
        nextBpm === lastBpm &&
        nextMeter.beatsPerMeasure === lastMeter.beatsPerMeasure &&
        nextMeter.noteValue === lastMeter.noteValue &&
        nextTotalMeasures === lastTotalMeasures
      ) {
        return;
      }
      lastBpm = nextBpm;
      lastMeter = nextMeter;
      lastTotalMeasures = nextTotalMeasures;
      applyTransportConfig(nextBpm, nextMeter, nextTotalMeasures);
    });

    return () => {
      unsubComposition();
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) return undefined;

    // Resume from paused Transport cursor (scheduler truth), not latency-shifted
    // UI playhead. Otherwise resume can jump backward by the display offset.
    const cursor = getTransportCursorSnapshot();
    const startBeat =
      cursor.state === "paused"
        ? cursor.ticks / cursor.ppq
        : useTransportStore.getState().playheadBeat;
    primePlaybackSession(startBeat);
    // Transport.start() is called by useAudioScheduler after Parts are built.

    const onLoop = () => {
      audioEngine.cancelAll();
      const es = useLayerEditorStore.getState();
      if (es.isRecordingLoop && es.selectedLoopId !== null) {
        const { meter, totalMeasures } = useCompositionStore.getState();
        const loopBeatLength = compositionLoopBeatLength(
          totalMeasures,
          meter.beatsPerMeasure,
        );
        useLayerStore
          .getState()
          .finalizeLoop(es.selectedLayerId, es.selectedLoopId, loopBeatLength);
        es.stopRecording();
      }
    };
    const detachLoopListener = attachLoopHandler(onLoop);

    let rafId = 0;

    const tick = () => {
      if (!useTransportStore.getState().isPlaying) return;
      if (useTransportStore.getState().isScrubbing) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      // Prevent a brief UI jump when isPlaying flips true but Transport.start()
      // hasn't happened yet (useAudioScheduler starts it async after Parts build).
      if (!isTransportStarted()) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const currentBeat = getNowbarBeat();
      const { followNowbar } = useTransportStore.getState();
      if (followNowbar) {
        const { meter: currentMeter, totalMeasures: currentTotalMeasures } =
          useCompositionStore.getState();
        const { midiMeasuresVisible } = useMidiStore.getState();
        const playheadIdx = playheadMeasureIndex(
          currentBeat,
          currentMeter.beatsPerMeasure,
        );
        const visible = Math.max(
          1,
          Math.min(midiMeasuresVisible, currentTotalMeasures),
        );
        const maxStart = Math.max(0, currentTotalMeasures - visible);
        const viewMeasureIndex = Math.max(0, Math.min(maxStart, playheadIdx));

        useTransportStore.setState({
          playheadBeat: currentBeat,
          viewMeasureIndex,
        });
      } else {
        useTransportStore.setState({ playheadBeat: currentBeat });
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      detachLoopListener();
    };
  }, [isPlaying]);
}
