import { useAppStore } from "../store/appStore";
import {
  beatsPerMeasureFromMeter,
  compositionLoopBeatLength,
  readMidiCompositionBeat,
} from "../lib/midiPlayhead";

function formatVisibleMeasuresLabel(startIdx0, visibleCount) {
  const a = startIdx0 + 1;
  const b = startIdx0 + visibleCount;
  if (visibleCount <= 1) {
    return `measure ${a}`;
  }
  return `measures ${a}-${b}`;
}

/**
 * Prev/next when the composition loop spans multiple measures.
 * Rendered in the main view bar (with layer / midi / sounds toggles), not above the roll.
 */
export default function MidiMeasureNav({ currentView }) {
  const meter = useAppStore((s) => s.meter);
  const masterLoopLength = useAppStore((s) => s.masterLoopLength);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const midiPlayheadBeat = useAppStore((s) => s.midiPlayheadBeat);
  const midiViewMeasureIndex = useAppStore((s) => s.midiViewMeasureIndex);
  const midiMeasuresVisible = useAppStore((s) => s.midiMeasuresVisible);
  const setMidiViewMeasureIndex = useAppStore((s) => s.setMidiViewMeasureIndex);
  const setMidiPlayheadBeat = useAppStore((s) => s.setMidiPlayheadBeat);
  const bumpTransportNonce = useAppStore((s) => s.bumpTransportNonce);

  const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
  const beatLength = compositionLoopBeatLength(
    masterLoopLength,
    beatsPerMeasure,
  );
  const measureCount = Math.max(1, Math.ceil(beatLength / beatsPerMeasure));
  const visibleCount = Math.max(
    1,
    Math.min(midiMeasuresVisible, measureCount, 4),
  );
  const maxWindowStart = Math.max(0, measureCount - visibleCount);

  const layerBeat = readMidiCompositionBeat(midiPlayheadBeat, beatLength);

  const playheadMeasureIdx = Math.floor(layerBeat / beatsPerMeasure);
  const playheadNotInView =
    playheadMeasureIdx < midiViewMeasureIndex ||
    playheadMeasureIdx >= midiViewMeasureIndex + visibleCount;

  const show =
    (currentView === "midi" || currentView === "dual") &&
    beatLength > beatsPerMeasure;

  if (!show) {
    return null;
  }

  return (
    <div className="midi-measure-nav midi-measure-nav--view-bar">
      <button
        type="button"
        className="midi-measure-btn"
        disabled={midiViewMeasureIndex <= 0}
        onClick={() =>
          setMidiViewMeasureIndex(Math.max(0, midiViewMeasureIndex - 1))
        }
        aria-label="previous measure"
      >
        ←
      </button>
      <span className="midi-measure-label">
        {formatVisibleMeasuresLabel(midiViewMeasureIndex, visibleCount)}
      </span>
      <button
        type="button"
        className="midi-measure-btn"
        disabled={midiViewMeasureIndex >= maxWindowStart}
        onClick={() =>
          setMidiViewMeasureIndex(
            Math.min(maxWindowStart, midiViewMeasureIndex + 1),
          )
        }
        aria-label="next measure"
      >
        →
      </button>
      {playheadNotInView && (
        <button
          type="button"
          className="midi-measure-btn midi-measure-snap"
          onClick={() => {
            setMidiPlayheadBeat(midiViewMeasureIndex * beatsPerMeasure);
            if (isPlaying) {
              bumpTransportNonce();
            }
          }}
          aria-label="move playhead to start of this measure"
        >
          ⟲ now bar
        </button>
      )}
    </div>
  );
}
