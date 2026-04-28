import { useShallow } from "zustand/react/shallow";
import { useMidiStore } from "../../store/midiStore";
import { useCompositionStore } from "../../store/compositionStore";
import { playheadMeasureIndex } from "../../utils/midiTransport";
import { snapPlayheadToView } from "../../utils/midiTransport";
import type { AppView } from "../../types/app";

interface MidiMeasureNavProps {
  currentView: AppView;
}

function formatVisibleMeasuresLabel(startIdx0: number, visibleCount: number) {
  const a = startIdx0 + 1;
  const b = startIdx0 + visibleCount;
  return visibleCount <= 1 ? `measure ${a}` : `measures ${a}-${b}`;
}

export default function MidiMeasureNav({ currentView }: MidiMeasureNavProps) {
  const {
    midiViewMeasureIndex,
    setMidiViewMeasureIndex,
    midiPlayheadBeat,
    midiMeasuresVisible,
  } = useMidiStore(
    useShallow((s) => ({
      midiViewMeasureIndex: s.midiViewMeasureIndex,
      setMidiViewMeasureIndex: s.setMidiViewMeasureIndex,
      midiPlayheadBeat: s.midiPlayheadBeat,
      midiMeasuresVisible: s.midiMeasuresVisible,
    })),
  );
  const { meter, totalMeasures } = useCompositionStore(
    useShallow((s) => ({
      meter: s.meter,
      totalMeasures: s.totalMeasures,
    })),
  );
  const beatsPerMeasure = meter.beatsPerMeasure;
  const maxStart = Math.max(0, totalMeasures - midiMeasuresVisible);
  const currentStart = Math.min(maxStart, midiViewMeasureIndex);
  const playheadMeasureIdx = playheadMeasureIndex(
    midiPlayheadBeat,
    beatsPerMeasure,
  );
  const playheadNotInView =
    playheadMeasureIdx < currentStart ||
    playheadMeasureIdx >= currentStart + midiMeasuresVisible;

  const handleSnapPlayhead = () => snapPlayheadToView(currentStart);

  return (
    <div className="midi-measure-nav midi-measure-nav--view-bar">
      <button
        type="button"
        className="midi-measure-btn"
        disabled={currentStart <= 0}
        onClick={() => setMidiViewMeasureIndex(currentStart - 1)}
        aria-label="previous measure"
      >
        ←
      </button>
      <span className="midi-measure-label">
        {formatVisibleMeasuresLabel(currentStart, midiMeasuresVisible)}
      </span>
      <button
        type="button"
        className="midi-measure-btn"
        disabled={currentStart >= maxStart}
        onClick={() => setMidiViewMeasureIndex(currentStart + 1)}
        aria-label="next measure"
      >
        →
      </button>
      {playheadNotInView && (
        <button
          type="button"
          className="midi-measure-btn midi-measure-snap"
          onClick={handleSnapPlayhead}
          aria-label="move playhead to start of this measure"
        >
          ⟲ now bar
        </button>
      )}
    </div>
  );
}
