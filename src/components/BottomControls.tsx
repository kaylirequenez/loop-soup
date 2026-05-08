import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  restartPlaybackFromBeat,
  seekTransportBeatAndPanic,
  snapPlayheadToMeasureStart,
} from "../audio/transportController";
import {
  compositionLoopBeatLength,
  maxMeasuresCompositionLimit,
} from "../utils/compositionState";
import { oneBasedRange } from "../utils";
import {
  transportBeat,
} from "../utils/midiTransport";
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
import { RepeatUnit } from "../types/layer";

export default function BottomControls() {
  const { isPlaying, togglePlaying } = useTransportStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      togglePlaying: s.togglePlaying,
    })),
  );
  const { meter, totalMeasures, setTotalMeasures } = useCompositionStore(
    useShallow((s) => ({
      meter: s.meter,
      totalMeasures: s.totalMeasures,
      setTotalMeasures: s.setTotalMeasures,
    })),
  );
  const {
    selectedLayerId,
    selectedLoopId,
    selectedInstanceId,
    isRecordingLoop,
    stopRecording,
  } = useLayerEditorStore(
    useShallow((s) => ({
      selectedLayerId: s.selectedLayerId,
      selectedLoopId: s.selectedLoopId,
      selectedInstanceId: s.selectedInstanceId,
      isRecordingLoop: s.isRecordingLoop,
      stopRecording: s.stopRecording,
    })),
  );
  const {
    layers,
    addNewLoop,
    shiftLoopNotesOctave,
    setLoopRepeatUnit,
    setLoopRepeatEvery,
  } = useLayerStore(
    useShallow((s) => ({
      layers: s.layers,
      addNewLoop: s.addNewLoop,
      shiftLoopNotesOctave: s.shiftLoopNotesOctave,
      setLoopRepeatUnit: s.setLoopRepeatUnit,
      setLoopRepeatEvery: s.setLoopRepeatEvery,
    })),
  );

  const compositionDims = {
    beatsPerMeasure: meter.beatsPerMeasure,
    compositionEndBeat: compositionLoopBeatLength(
      totalMeasures,
      meter.beatsPerMeasure,
    ),
  };
  const { midiMeasuresVisible, setMidiMeasuresVisible } = useMidiStore(
    useShallow((s) => ({
      midiMeasuresVisible: s.midiMeasuresVisible,
      setMidiMeasuresVisible: s.setMidiMeasuresVisible,
    })),
  );
  const { viewMeasureIndex, setViewMeasureIndex } = useTransportStore(
    useShallow((s) => ({
      viewMeasureIndex: s.viewMeasureIndex,
      setViewMeasureIndex: s.setViewMeasureIndex,
    })),
  );

  const activeLoopData =
    selectedLoopId != null
      ? (layers[selectedLayerId].layerLoops[selectedLoopId] ?? null)
      : null;
  const activeLoop = activeLoopData
    ? {
        loop: activeLoopData,
        instance:
          selectedInstanceId != null
            ? (activeLoopData.loopInstances[selectedInstanceId] ?? null)
            : null,
      }
    : null;

  /** Repeat spacing is edited for the whole loop; individual instance placement uses repeatCount elsewhere (future UI). */
  const repeatControlsEnabled = selectedLoopId != null;
  const loopEnabled = selectedLoopId != null;
  const canRemoveLastMeasure = totalMeasures >= 2;
  const canAddMeasure = totalMeasures < maxMeasuresCompositionLimit();
  const spanBeats = activeLoop?.loop.definition.spanBeats;
  const repeatUnit = activeLoop?.loop.definition.repeatUnit ?? "measures";
  const repeatEvery = activeLoop?.loop
    ? getRepeatEveryForUnit(repeatUnit, activeLoop.loop.definition)
    : null;

  const loopNotes = activeLoop?.loop.definition.notes ?? [];
  const canTransposeDown =
    loopEnabled && canShiftLoopNotesOctaveBy(loopNotes, -1);
  const canTransposeUp = loopEnabled && canShiftLoopNotesOctaveBy(loopNotes, 1);

  const handleStartRecording = () => {
    addNewLoop(selectedLayerId);
  };

  const handleEndRecording = () => {
    const es = useLayerEditorStore.getState();
    const endBeat = transportBeat();
    if (es.selectedLoopId !== null) {
      useLayerStore
        .getState()
        .finalizeLoop(es.selectedLayerId, es.selectedLoopId, endBeat);
    }
    stopRecording();
  };

  useEffect(() => {
    if (!isPlaying && useLayerEditorStore.getState().isRecordingLoop) {
      handleEndRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const handleRestartFromStart = () => {
    if (isPlaying) {
      restartPlaybackFromBeat(0);
    } else {
      seekTransportBeatAndPanic(0);
    }
    setViewMeasureIndex(0);
  };

  const handleSnapPlayhead = () => snapPlayheadToMeasureStart(viewMeasureIndex);
  const handleAddMeasure = () => {
    const newTotal = totalMeasures + 1;
    setTotalMeasures(newTotal);
    setViewMeasureIndex(newTotal - midiMeasuresVisible);
  };

  const handleRemoveMeasure = () => {
    if (!canRemoveLastMeasure) return;
    const newTotal = totalMeasures - 1;
    const nextVisible = Math.min(midiMeasuresVisible, newTotal);
    const nextMaxStart = Math.max(0, newTotal - nextVisible);
    setMidiMeasuresVisible(nextVisible);
    setTotalMeasures(newTotal);
    setViewMeasureIndex(Math.min(viewMeasureIndex, nextMaxStart));
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
              className={`btn-add ${isRecordingLoop ? "btn-add-on" : ""}`}
              onClick={
                isRecordingLoop ? handleEndRecording : handleStartRecording
              }
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
            className={`repeat-split-col ${!repeatControlsEnabled ? "cluster-repeat--locked" : ""}`}
          >
            <div className="repeat-header-inline">
              <div className="clbl2">repeat every n</div>
              <div className="ctrls ctrls-wrap">
                {["measures", "beats"].map((value) => (
                  <button
                    key={`u-${value}`}
                    type="button"
                    className={`rep-btn ${repeatUnit === value ? "rep-on" : ""}`}
                    disabled={!repeatControlsEnabled}
                    onClick={() => {
                      if (repeatControlsEnabled && activeLoop) {
                        setLoopRepeatUnit(
                          selectedLayerId,
                          selectedLoopId,
                          value as RepeatUnit,
                          compositionDims,
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
                      !repeatControlsEnabled ||
                      spanBeats == null ||
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
                          if (repeatControlsEnabled && activeLoop) {
                            setLoopRepeatEvery(
                              selectedLayerId,
                              selectedLoopId,
                              repeatEvery === n ? null : n,
                              compositionDims,
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
                      if (selectedLoopId != null) {
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
                      if (selectedLoopId != null) {
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
