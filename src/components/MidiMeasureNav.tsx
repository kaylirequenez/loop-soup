import { useAppStore } from "../store/appStore";
import { useMidiViewportMetrics } from "../store/hooks";
import type { AppView } from "../types/model";

interface MidiMeasureNavProps {
  currentView: AppView;
}

function formatVisibleMeasuresLabel(startIdx0: number, visibleCount: number) {
  const a = startIdx0 + 1;
  const b = startIdx0 + visibleCount;
  return visibleCount <= 1 ? `measure ${a}` : `measures ${a}-${b}`;
}

export default function MidiMeasureNav({ currentView }: MidiMeasureNavProps) {
  const midiViewMeasureIndex = useAppStore((s) => s.midiViewMeasureIndex);
  const setMidiViewMeasureIndex = useAppStore((s) => s.setMidiViewMeasureIndex);
  const snapPlayheadToVisibleWindowStart = useAppStore(
    (s) => s.snapPlayheadToVisibleWindowStart,
  );
  const { beatsPerMeasure, beatLength, visibleCount, maxStart, playheadNotInView } =
    useMidiViewportMetrics();

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
        onClick={() => setMidiViewMeasureIndex(Math.max(0, midiViewMeasureIndex - 1))}
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
        disabled={midiViewMeasureIndex >= maxStart}
        onClick={() =>
          setMidiViewMeasureIndex(Math.min(maxStart, midiViewMeasureIndex + 1))
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
