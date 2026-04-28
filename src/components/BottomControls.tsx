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
import { IconRestartComposition, IconRestartView } from "../ui/restartIcons";

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
    setMidiMeasuresVisible,
    setMidiViewMeasureIndex,
  } = useMidiStore(
    useShallow((s) => ({
      midiMeasuresVisible: s.midiMeasuresVisible,
      midiViewMeasureIndex: s.midiViewMeasureIndex,
      setMidiPlayheadBeat: s.setMidiPlayheadBeat,
      setMidiMeasuresVisible: s.setMidiMeasuresVisible,
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
  const canAddMeasure = totalMeasures < maxMeasuresCompositionLimit();
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
    setMidiViewMeasureIndex(newTotal - midiMeasuresVisible);
  };

  const handleRemoveMeasure = () => {
    if (!canRemoveLastMeasure) return;
    const newTotal = totalMeasures - 1;
    setMidiMeasuresVisible(Math.min(midiMeasuresVisible, newTotal));
    setTotalMeasures(newTotal);
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
              onClick={handleRemoveMeasure}
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
