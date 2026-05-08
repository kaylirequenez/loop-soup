import { useShallow } from "zustand/react/shallow";
import { useMidiStore } from "../../store/midiStore";
import { useTransportStore } from "../../store/transportStore";
import { useCompositionStore } from "../../store/compositionStore";
import { playheadMeasureIndex } from "../../audio/transportController";
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
  const { midiMeasuresVisible } = useMidiStore(
    useShallow((s) => ({ midiMeasuresVisible: s.midiMeasuresVisible })),
  );
  const {
    viewMeasureIndex,
    setViewMeasureIndex,
    playheadBeat,
    followNowbar,
    setFollowNowbar,
  } = useTransportStore(
    useShallow((s) => ({
      viewMeasureIndex: s.viewMeasureIndex,
      setViewMeasureIndex: s.setViewMeasureIndex,
      playheadBeat: s.playheadBeat,
      followNowbar: s.followNowbar,
      setFollowNowbar: s.setFollowNowbar,
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
  const currentStart = Math.min(maxStart, viewMeasureIndex);
  const playheadMeasureIdx = playheadMeasureIndex(playheadBeat, beatsPerMeasure);
  const handleToggleFollowNowbar = () => {
    const nextFollow = !followNowbar;
    setFollowNowbar(nextFollow);
    if (!nextFollow) return;
    const nextStart = Math.max(0, Math.min(maxStart, playheadMeasureIdx));
    setViewMeasureIndex(nextStart);
  };

  return (
    <div className="midi-measure-nav midi-measure-nav--view-bar">
      <button
        type="button"
        className="midi-measure-btn"
        disabled={currentStart <= 0}
        onClick={() => setViewMeasureIndex(currentStart - 1)}
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
        onClick={() => setViewMeasureIndex(currentStart + 1)}
        aria-label="next measure"
      >
        →
      </button>
      <button
        type="button"
        className={`rep-btn ${followNowbar ? "rep-on" : ""}`}
        onClick={handleToggleFollowNowbar}
        aria-label={followNowbar ? "disable nowbar follow" : "enable nowbar follow"}
        aria-pressed={followNowbar}
      >
        follow nowbar
      </button>
    </div>
  );
}
