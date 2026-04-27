import { useShallow } from "zustand/react/shallow";
import { maxMeasuresCompositionLimit } from "../utils/compositionState";
import { oneBasedRange } from "../utils";
import { snapPlayheadToView } from "../utils/midiTransport";
import {
  getRepeatEveryForUnit,
  isRepeatDisabledForUnit,
  maxRepeatEveryForUnit,
  canShiftLoopNotesOctaveBy,
} from "../utils/layerState";
import { useLayerStore } from "../store/layerStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useMidiStore } from "../store/midiStore";
import { useCompositionStore } from "../store/compositionStore";
import { useTransportStore } from "../store/transportStore";

const RESTART_BAR = { x: 2, y: 6.5, w: 2, h: 11, rx: 0.4 };
const RESTART_BAR_RIGHT = RESTART_BAR.x + RESTART_BAR.w;
const RESTART_DOUBLE_CHEVRON_LEFT = `M ${RESTART_BAR_RIGHT} 12 L 9 6.5 L 9 17.5 Z M 9 12 L 14 6.5 L 14 17.5 Z`;
const RESTART_SINGLE_CHEVRON_LEFT = `M ${RESTART_BAR_RIGHT} 12 L 11 6.5 L 11 17.5 Z`;
const RESTART_ICON_CENTER_X_COMPOSITION = 4;
const RESTART_ICON_CENTER_X_VIEW = 5.5;

function IconRestartComposition() {
  const { x, y, w, h, rx } = RESTART_BAR;
  return (
    <svg
      className="btn-restart-svg"
      viewBox="0 0 24 24"
      width={15}
      height={15}
      aria-hidden
    >
      <g transform={`translate(${RESTART_ICON_CENTER_X_COMPOSITION}, 0)`}>
        <rect x={x} y={y} width={w} height={h} rx={rx} fill="currentColor" />
        <path fill="currentColor" d={RESTART_DOUBLE_CHEVRON_LEFT} />
      </g>
    </svg>
  );
}

function IconRestartView() {
  const { x, y, w, h, rx } = RESTART_BAR;
  return (
    <svg
      className="btn-restart-svg"
      viewBox="0 0 24 24"
      width={15}
      height={15}
      aria-hidden
    >
      <g transform={`translate(${RESTART_ICON_CENTER_X_VIEW}, 0)`}>
        <rect x={x} y={y} width={w} height={h} rx={rx} fill="currentColor" />
        <path fill="currentColor" d={RESTART_SINGLE_CHEVRON_LEFT} />
      </g>
    </svg>
  );
}

export default function BottomControls() {
  const { isPlaying, addOn, togglePlaying, toggleAddOn, bumpTransportNonce } =
    useTransportStore(
      useShallow((s) => ({
        isPlaying: s.isPlaying,
        addOn: s.addOn,
        togglePlaying: s.togglePlaying,
        toggleAddOn: s.toggleAddOn,
        bumpTransportNonce: s.bumpTransportNonce,
      })),
    );
  const { meter, totalMeasures, setTotalMeasures } = useCompositionStore(
    useShallow((s) => ({
      meter: s.meter,
      totalMeasures: s.totalMeasures,
      setTotalMeasures: s.setTotalMeasures,
    })),
  );
  const { selectedLayerId, selectedLoopId, selectedInstanceId } =
    useLayerEditorStore(
      useShallow((s) => ({
        selectedLayerId: s.selectedLayerId,
        selectedLoopId: s.selectedLoopId,
        selectedInstanceId: s.selectedInstanceId,
      })),
    );
  const {
    layers,
    shiftLoopNotesOctave,
    setLoopInstanceRepeatUnit,
    toggleLoopInstanceRepeatEvery,
  } = useLayerStore(
    useShallow((s) => ({
      layers: s.layers,
      shiftLoopNotesOctave: s.shiftLoopNotesOctave,
      setLoopInstanceRepeatUnit: s.setLoopInstanceRepeatUnit,
      toggleLoopInstanceRepeatEvery: s.toggleLoopInstanceRepeatEvery,
    })),
  );
  const {
    midiMeasuresVisible,
    midiViewMeasureIndex,
    setMidiPlayheadBeat,
    setMidiViewMeasureIndex,
  } = useMidiStore(
    useShallow((s) => ({
      midiMeasuresVisible: s.midiMeasuresVisible,
      midiViewMeasureIndex: s.midiViewMeasureIndex,
      setMidiPlayheadBeat: s.setMidiPlayheadBeat,
      setMidiViewMeasureIndex: s.setMidiViewMeasureIndex,
    })),
  );

  const activeLoop =
    selectedLoopId != null
      ? {
          loop: layers[selectedLayerId].layerLoops[selectedLoopId],
          instance:
            selectedInstanceId != null
              ? layers[selectedLayerId].layerLoops[selectedLoopId]
                  .loopInstances[selectedInstanceId]
              : null,
        }
      : null;

  const instanceEnabled = selectedInstanceId != null;
  const loopEnabled = selectedLoopId != null;
  const canRemoveLastMeasure = totalMeasures >= 2;
  const canAddMeasure =
    totalMeasures < maxMeasuresCompositionLimit(meter.beatsPerMeasure);
  const spanBeats = activeLoop?.loop.definition.spanBeats ?? 1;
  const repeatUnit = activeLoop?.instance?.repeatUnit ?? "measures";
  const repeatEvery = activeLoop?.instance
    ? getRepeatEveryForUnit(repeatUnit, activeLoop.instance)
    : null;

  const loopNotes = activeLoop?.loop.definition.notes ?? [];
  const canTransposeDown =
    loopEnabled && canShiftLoopNotesOctaveBy(loopNotes, -1);
  const canTransposeUp = loopEnabled && canShiftLoopNotesOctaveBy(loopNotes, 1);

  const handleRestartFromStart = () => {
    bumpTransportNonce();
    setMidiPlayheadBeat(0);
    setMidiViewMeasureIndex(0);
  };

  const handleSnapPlayhead = () => snapPlayheadToView(midiViewMeasureIndex);

  const handleAddMeasure = () => {
    const newTotal = totalMeasures + 1;
    setTotalMeasures(newTotal);
    const vis = Math.min(midiMeasuresVisible, newTotal);
    setMidiViewMeasureIndex(Math.max(0, newTotal - vis));
  };

  return (
    <div className="bottom">
      <div className="bottom-bar">
        <div className="cluster">
          <div className="clbl2">transport</div>
          <div className="ctrls">
            <button
              className={`btn-play ${isPlaying ? "btn-play-on" : ""}`}
              onClick={togglePlaying}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              className="btn-restart"
              onClick={handleRestartFromStart}
            >
              <IconRestartComposition />
            </button>
            <button
              type="button"
              className="btn-restart"
              onClick={handleSnapPlayhead}
            >
              <IconRestartView />
            </button>
            <button
              className={`btn-add ${addOn ? "btn-add-on" : ""}`}
              onClick={toggleAddOn}
            >
              +
            </button>
          </div>
        </div>
        <div className="sep" />
        <div className="cluster">
          <div className="clbl2">extend</div>
          <div className="ctrls ctrls-extend">
            <button
              type="button"
              className="btn"
              disabled={!canAddMeasure}
              onClick={handleAddMeasure}
            >
              + measure
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (canRemoveLastMeasure) setTotalMeasures(totalMeasures - 1);
              }}
              disabled={!canRemoveLastMeasure}
            >
              - measure
            </button>
          </div>
        </div>
        <div className="sep" />
        <div className="cluster cluster-repeat cluster-repeat-split">
          <div
            className={`repeat-split-col ${!instanceEnabled ? "cluster-repeat--locked" : ""}`}
          >
            <div className="repeat-header-inline">
              <div className="clbl2">repeat every n</div>
              <div className="ctrls ctrls-wrap">
                {["measures", "beats"].map((value) => (
                  <button
                    key={`u-${value}`}
                    type="button"
                    className={`rep-btn ${repeatUnit === value ? "rep-on" : ""}`}
                    disabled={!instanceEnabled}
                    onClick={() => {
                      if (activeLoop?.instance) {
                        setLoopInstanceRepeatUnit(
                          selectedLayerId,
                          activeLoop.loop.id,
                          activeLoop.instance.id,
                          value as "measures" | "beats",
                          meter.beatsPerMeasure,
                        );
                      }
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="repeat-block repeat-block--toggles">
              <div className="repeat-sub">
                <div className="ctrls ctrls-wrap repeat-split-values">
                  {oneBasedRange(
                    maxRepeatEveryForUnit(repeatUnit, meter.beatsPerMeasure),
                  ).map((n) => {
                    const disabled =
                      !instanceEnabled ||
                      isRepeatDisabledForUnit(
                        spanBeats,
                        meter.beatsPerMeasure,
                        repeatUnit,
                        n,
                      );
                    return (
                      <button
                        key={`r-${repeatUnit}-${n}`}
                        type="button"
                        className={`rep-btn ${repeatEvery === n ? "rep-on" : ""}`}
                        disabled={disabled}
                        onClick={() => {
                          if (activeLoop?.instance) {
                            toggleLoopInstanceRepeatEvery(
                              selectedLayerId,
                              activeLoop.loop.id,
                              activeLoop.instance.id,
                              n,
                              meter.beatsPerMeasure,
                            );
                          }
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="sep" />
          <div className="repeat-split-col repeat-split-col-transpose">
            <div className="clbl2">octave</div>
            <div className="transpose-block repeat-split-values">
              <div
                className={`transpose-row ${!loopEnabled ? "cluster-repeat--locked" : ""}`}
              >
                <div className="ctrls ctrls-oct">
                  <button
                    type="button"
                    className="btn"
                    disabled={!canTransposeDown}
                    onClick={() => {
                      if (selectedLoopId) {
                        shiftLoopNotesOctave(
                          selectedLayerId,
                          selectedLoopId,
                          -1,
                        );
                      }
                    }}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!canTransposeUp}
                    onClick={() => {
                      if (selectedLoopId) {
                        shiftLoopNotesOctave(
                          selectedLayerId,
                          selectedLoopId,
                          1,
                        );
                      }
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
