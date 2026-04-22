import type { AppState } from "./appStore";
import { getTimelineMetrics, playheadMeasureIndex } from "./utils/timeline";
import { normalizeRepeatUnit, repeatEveryForUnit } from "../lib/loopModel";

export function selectViewFlags(state: AppState) {
  const showLayers = state.currentView === "layers" || state.currentView === "dual";
  const showMidi = state.currentView === "midi" || state.currentView === "dual";
  const dualView = state.currentView === "dual";
  return { showLayers, showMidi, dualView };
}

export function selectCompositionTiming(state: AppState) {
  const metrics = getTimelineMetrics(
    state.meter,
    state.masterLoopLength,
    state.midiMeasuresVisible,
  );
  const layerBeat = state.midiPlayheadBeat;
  const nowMeasure = Math.min(
    metrics.measureCount,
    Math.floor(layerBeat / metrics.beatsPerMeasure) + 1,
  );
  return {
    ...metrics,
    layerBeat,
    nowMeasure,
    canRemoveLastMeasure: metrics.measureCount >= 2,
  };
}

export function selectMidiViewportMetrics(state: AppState) {
  const metrics = getTimelineMetrics(
    state.meter,
    state.masterLoopLength,
    state.midiMeasuresVisible,
  );
  const currentStart = Math.max(0, Math.min(metrics.maxStart, state.midiViewMeasureIndex));
  const playheadMeasureIdx = playheadMeasureIndex(
    state.midiPlayheadBeat,
    metrics.beatLength,
    metrics.beatsPerMeasure,
    metrics.measureCount,
  );
  const playheadNotInView =
    playheadMeasureIdx < currentStart ||
    playheadMeasureIdx >= currentStart + metrics.visibleCount;
  return {
    ...metrics,
    midiViewMeasureIndex: currentStart,
    playheadMeasureIdx,
    playheadNotInView,
  };
}

export function selectActiveLoopContext(state: AppState) {
  const selectedLayerData = state.layers[state.selectedLayer];
  const activeLoopIndex = Math.min(
    Math.max(0, (selectedLayerData?.loops?.length ?? 1) - 1),
    selectedLayerData?.activeLoopIndex ?? 0,
  );
  const activeLoop = selectedLayerData?.loops?.[activeLoopIndex] ?? null;
  const repeatPhraseEnabled = state.midiNoteSelection != null;
  const repeatPlacementEnabled = repeatPhraseEnabled && state.midiLoopEditMode == null;
  const repeatUnit = normalizeRepeatUnit(activeLoop?.repeatUnit);
  const repeatEvery = repeatEveryForUnit(
    activeLoop ?? {
      repeatUnit: "measures",
      repeatEveryMeasuresMemory: null,
      repeatEveryBeatsMemory: null,
    },
  );
  return {
    activeLoop,
    activeLoopIndex,
    repeatPhraseEnabled,
    repeatPlacementEnabled,
    repeatUnit,
    repeatEvery,
  };
}

export function selectAppShellState(state: AppState) {
  return {
    isPlaying: state.isPlaying,
    addOn: state.addOn,
    bpm: state.bpm,
    keyName: state.key,
    meter: state.meter,
    selectedLayer: state.selectedLayer,
    midiNoteSelection: state.midiNoteSelection,
    octaveView: state.octaveView,
  };
}

export function selectAppShellActions(state: AppState) {
  return {
    togglePlaying: state.togglePlaying,
    restartTransportFromStart: state.restartTransportFromStart,
    snapPlayheadToVisibleWindowStart: state.snapPlayheadToVisibleWindowStart,
    toggleAddOn: state.toggleAddOn,
    setLayerRepeatUnit: state.setLayerRepeatUnit,
    toggleLayerRepeatEvery: state.toggleLayerRepeatEvery,
    setLayerLoopStartMeasure: state.setLayerLoopStartMeasure,
    setLayerLoopRepeatEndMeasure: state.setLayerLoopRepeatEndMeasure,
    setOctaveView: state.setOctaveView,
    shiftLayerLoopNotesOctave: state.shiftLayerLoopNotesOctave,
    addCompositionMeasure: state.addCompositionMeasure,
    removeLastCompositionMeasure: state.removeLastCompositionMeasure,
    setBpm: state.setBpm,
    setKey: state.setKey,
    clearPersistedSession: state.clearPersistedSession,
  };
}

export function selectCompositionViewState(state: AppState) {
  return {
    selectedLayer: state.selectedLayer,
    layers: state.layers,
    meter: state.meter,
    masterLoopLength: state.masterLoopLength,
    midiPlayheadBeat: state.midiPlayheadBeat,
    midiNoteSelection: state.midiNoteSelection,
    midiRollCount: state.midiRollCount,
    midiRollSplitByRootOctave: state.midiRollSplitByRootOctave,
    midiLoopRollPlacement: state.midiLoopRollPlacement,
  };
}

export function selectCompositionViewActions(state: AppState) {
  return {
    setLayerLoopPhraseSelection: state.setLayerLoopPhraseSelection,
    seekCompositionTimelineToBeat: state.seekCompositionTimelineToBeat,
    setMidiLoopRollPlacement: state.setMidiLoopRollPlacement,
  };
}
