import { useMidiStore } from "../store/midiStore";
import { useTransportStore } from "../store/transportStore";
import { getTimelineMetrics, playheadMeasureIndex } from "../store/utils/timeline";
import type { AppView } from "../types/app";

interface MidiMeasureNavProps {
  currentView: AppView;
}

function formatVisibleMeasuresLabel(startIdx0: number, visibleCount: number) {
  const a = startIdx0 + 1;
  const b = startIdx0 + visibleCount;
  return visibleCount <= 1 ? `measure ${a}` : `measures ${a}-${b}`;
}

export default function MidiMeasureNav({ currentView }: MidiMeasureNavProps) {
  const midiViewMeasureIndex = useMidiStore((s) => s.midiViewMeasureIndex);
  const setMidiViewMeasureIndex = useMidiStore((s) => s.setMidiViewMeasureIndex);
  const snapPlayheadToVisibleWindowStart = useMidiStore(
    (s) => s.snapPlayheadToVisibleWindowStart,
  );
  const midiPlayheadBeat = useMidiStore((s) => s.midiPlayheadBeat);
  const midiMeasuresVisible = useMidiStore((s) => s.midiMeasuresVisible);
  const meter = useTransportStore((s) => s.meter);
  const masterLoopLength = useTransportStore((s) => s.masterLoopLength);
  const { beatsPerMeasure, beatLength, visibleCount, maxStart } = getTimelineMetrics(
    meter,
    masterLoopLength,
    midiMeasuresVisible,
  );
  const currentStart = Math.max(0, Math.min(maxStart, midiViewMeasureIndex));
  const playheadMeasureIdx = playheadMeasureIndex(
    midiPlayheadBeat,
    beatLength,
    beatsPerMeasure,
    Math.max(1, Math.ceil(beatLength / beatsPerMeasure)),
  );
  const playheadNotInView =
    playheadMeasureIdx < currentStart ||
    playheadMeasureIdx >= currentStart + visibleCount;

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
        disabled={currentStart <= 0}
        onClick={() => setMidiViewMeasureIndex(Math.max(0, currentStart - 1))}
        aria-label="previous measure"
      >
        ←
      </button>
      <span className="midi-measure-label">
        {formatVisibleMeasuresLabel(currentStart, visibleCount)}
      </span>
      <button
        type="button"
        className="midi-measure-btn"
        disabled={currentStart >= maxStart}
        onClick={() =>
          setMidiViewMeasureIndex(Math.min(maxStart, currentStart + 1))
        }
        aria-label="next measure"
      >
        →
      </button>
      {playheadNotInView && (
        <button
          type="button"
          className="midi-measure-btn midi-measure-snap"
          onClick={snapPlayheadToVisibleWindowStart}
          aria-label="move playhead to start of this measure"
        >
          ⟲ now bar
        </button>
      )}
    </div>
  );
}
