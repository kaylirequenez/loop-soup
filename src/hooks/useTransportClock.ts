import { useEffect } from "react";
import { getTransport } from "tone";
import type { Meter } from "../types/composition";
import { useMidiStore } from "../store/midiStore";
import { useTransportStore } from "../store/transportStore";
import { useCompositionStore } from "../store/compositionStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerStore } from "../store/layerStore";
import {
  playheadMeasureIndex,
  seekTransportBeat,
  transportBeat,
} from "../utils/midiTransport";
import { clamp } from "../utils";
import { compositionLoopBeatLength } from "../utils/compositionState";
import { audioEngine } from "../audio/audioEngine";
import { transportDebug } from "../utils/transportDebug";

export function useTransportClock() {
  const isPlaying = useTransportStore((s) => s.isPlaying);

  useEffect(() => {
    const transport = getTransport();
    const applyTransportConfig = (
      bpm: number,
      meter: Meter,
      totalMeasures: number,
    ) => {
      const beatLength = compositionLoopBeatLength(
        totalMeasures,
        meter.beatsPerMeasure,
      );
      const loopStartPosition = "0:0:0";
      const loopEndPosition = `${totalMeasures}:0:0`;
      transport.bpm.value = clamp(bpm, 40, 240);
      transport.timeSignature = [meter.beatsPerMeasure, meter.noteValue];
      transport.loopStart = loopStartPosition;
      transport.loopEnd = loopEndPosition;
      transportDebug("applyTransportConfig", {
        bpm: transport.bpm.value,
        meter: meter.toString(),
        totalMeasures,
        beatLength,
        loopStartPosition,
        loopEndPosition,
        loopEnd: transport.loopEnd,
      });
    };

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

    const transport = getTransport();
    transportDebug("clockEffect:start", {
      state: transport.state,
      ticks: transport.ticks,
    });

    // Seek to the user-visible playhead position before Transport starts.
    const startBeat = useTransportStore.getState().playheadBeat;
    seekTransportBeat(startBeat);
    transport.loop = true;
    transportDebug("clockEffect:seek+loop", {
      startBeat,
      ticks: transport.ticks,
      loop: transport.loop,
    });
    // Transport.start() is called by useAudioScheduler after Parts are built.

    const onLoop = () => {
      transportDebug("transport:loop", { ticks: transport.ticks });
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
    transport.on("loop", onLoop);

    let rafId = 0;

    const tick = () => {
      if (!useTransportStore.getState().isPlaying) return;
      if (useTransportStore.getState().isScrubbing) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      // Prevent a brief UI jump when isPlaying flips true but Transport.start()
      // hasn't happened yet (useAudioScheduler starts it async after Parts build).
      if (transport.state !== "started") {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const currentBeat = transportBeat();
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
      transportDebug("tick:updatePlayhead", {
        currentBeat,
        viewMeasureIndex,
        ticks: transport.ticks,
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      transport.off("loop", onLoop);
      transportDebug("clockEffect:cleanupDetach", {
        state: transport.state,
        ticks: transport.ticks,
      });
    };
  }, [isPlaying]);
}
