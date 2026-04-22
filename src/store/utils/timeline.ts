import {
  beatsPerMeasureFromMeter,
  compositionLoopBeatLength,
  readMidiCompositionBeat,
} from "../../lib/midiPlayhead";

export interface TimelineMetrics {
  beatsPerMeasure: number;
  beatLength: number;
  measureCount: number;
  visibleCount: number;
  maxStart: number;
}

export function getTimelineMetrics(
  meter: string,
  masterLoopLength: number,
  midiMeasuresVisible: number,
): TimelineMetrics {
  const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
  const beatLength = compositionLoopBeatLength(masterLoopLength, beatsPerMeasure);
  const measureCount = Math.max(1, Math.ceil(beatLength / beatsPerMeasure));
  const visibleCount = Math.max(1, Math.min(midiMeasuresVisible, measureCount, 4));
  const maxStart = Math.max(0, measureCount - visibleCount);
  return { beatsPerMeasure, beatLength, measureCount, visibleCount, maxStart };
}

export function wrapBeat(beat: number, beatLength: number): number {
  const len = Math.max(1e-6, beatLength);
  let w = ((beat % len) + len) % len;
  if (w >= len - 1e-9) {
    w = 0;
  }
  return Math.min(Math.max(0, w), len - 1e-6);
}

export function clampMidiViewStart(value: number, maxStart: number): number {
  return Math.max(0, Math.min(maxStart, value));
}

export function playheadMeasureIndex(
  midiPlayheadBeat: number,
  beatLength: number,
  beatsPerMeasure: number,
  measureCount: number,
): number {
  const layerBeat = readMidiCompositionBeat(midiPlayheadBeat, beatLength);
  return Math.min(
    measureCount - 1,
    Math.max(0, Math.floor(layerBeat / beatsPerMeasure)),
  );
}

export function clampStateMidiViewStart(params: {
  meter: string;
  masterLoopLength: number;
  midiMeasuresVisible: number;
  midiViewMeasureIndex: number;
}): number {
  const metrics = getTimelineMetrics(
    params.meter,
    params.masterLoopLength,
    params.midiMeasuresVisible,
  );
  return clampMidiViewStart(params.midiViewMeasureIndex, metrics.maxStart);
}
