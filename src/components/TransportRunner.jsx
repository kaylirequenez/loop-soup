import { useEffect } from "react";
import { useAppStore } from "../store/appStore";
import {
  beatsPerMeasureFromMeter,
  compositionLoopBeatLength,
  midiViewWindowStartForPlayhead,
} from "../lib/midiPlayhead";

const MAX_DT_MS = 250;

/**
 * Advances the selected layer’s playhead in real time from BPM while isPlaying.
 * Also follows the MIDI roll view to the measure that contains the playhead.
 */
export default function TransportRunner() {
  const isPlaying = useAppStore((s) => s.isPlaying);
  const transportNonce = useAppStore((s) => s.transportNonce);

  useEffect(() => {
    if (!isPlaying) {
      return undefined;
    }

    let rafId;
    let lastT = performance.now();

    const tick = () => {
      const s = useAppStore.getState();
      if (!s.isPlaying) {
        return;
      }

      const now = performance.now();
      const dt = Math.min(now - lastT, MAX_DT_MS);
      lastT = now;

      const bpm = Math.max(40, Math.min(240, s.bpm));
      const msPerBeat = 60000 / bpm;
      const beatsPerMeasure = beatsPerMeasureFromMeter(s.meter);
      const beatLength = compositionLoopBeatLength(
        s.masterLoopLength,
        beatsPerMeasure,
      );
      const prev = s.midiPlayheadBeat ?? 0;
      const nextRaw = prev + dt / msPerBeat;

      s.setMidiPlayheadBeat(nextRaw);

      const st = useAppStore.getState();
      const nextBeat = st.midiPlayheadBeat ?? 0;
      const measureCount = Math.max(1, Math.ceil(beatLength / beatsPerMeasure));
      const playheadMeasureIdx = Math.min(
        measureCount - 1,
        Math.max(0, Math.floor(nextBeat / beatsPerMeasure)),
      );
      const visible = Math.max(
        1,
        Math.min(st.midiMeasuresVisible, measureCount, 4),
      );
      const windowStart = midiViewWindowStartForPlayhead(
        playheadMeasureIdx,
        measureCount,
        visible,
        st.midiViewMeasureIndex,
      );
      st.setMidiViewMeasureIndex(windowStart);

      const phase = beatLength > 0 ? nextBeat / beatLength : 0;
      st.setPlayheadPhase(Math.max(0, Math.min(1, phase)));

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, transportNonce]);

  return null;
}
