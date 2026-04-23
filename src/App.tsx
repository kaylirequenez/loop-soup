import { useState } from "react";
import BottomControls from "./components/BottomControls";
import CompositionView from "./components/CompositionView";
import DevToolbar from "./components/app/DevToolbar";
import WorkspacePanel from "./components/app/WorkspacePanel";
import MakeHookModal from "./components/MakeHookModal";
import TransportRunner from "./components/TransportRunner";
import SoftPot from "./components/SoftPot";
import TopBar from "./components/TopBar";
import { activeLayerLoopForEditorFocus } from "./lib/layerRuntime";
import { useMidiStore } from "./store/midiStore";
import { useLayerStore } from "./store/layerStore";
import { useLayerEditorStore } from "./store/layerEditorStore";
import { useLoopDefinitionStore } from "./store/loopDefinitionStore";
import { useTransportStore } from "./store/transportStore";
import { getTimelineMetrics } from "./store/utils/timeline";
import { repeatEveryForUnit } from "./lib/loopModel";

export default function App() {
  const [showHookModal, setShowHookModal] = useState(false);
  const isPlaying = useTransportStore((s) => s.isPlaying);
  const addOn = useTransportStore((s) => s.addOn);
  const bpm = useTransportStore((s) => s.bpm);
  const keyName = useTransportStore((s) => s.key);
  const meter = useTransportStore((s) => s.meter);
  const togglePlaying = useTransportStore((s) => s.togglePlaying);
  const toggleAddOn = useTransportStore((s) => s.toggleAddOn);
  const setBpm = useTransportStore((s) => s.setBpm);
  const setKey = useTransportStore((s) => s.setKey);
  const masterLoopLength = useTransportStore((s) => s.masterLoopLength);
  const selectedLayerId = useLayerEditorStore((s) => s.selectedLayerId);
  const selectedLoopFocusByLayer = useLayerEditorStore((s) => s.selectedLoopFocusByLayer);
  const layers = useLayerStore((s) => s.layers);
  const definitions = useLoopDefinitionStore((s) => s.definitions);
  const midiNoteSelection = useMidiStore((s) => s.midiNoteSelection);
  const midiLoopEditMode = useMidiStore((s) => s.midiLoopEditMode);
  const midiPlayheadBeat = useMidiStore((s) => s.midiPlayheadBeat);
  const midiMeasuresVisible = useMidiStore((s) => s.midiMeasuresVisible);
  const octaveView = useMidiStore((s) => s.octaveView);
  const restartTransportFromStart = useMidiStore((s) => s.restartTransportFromStart);
  const snapPlayheadToVisibleWindowStart = useMidiStore(
    (s) => s.snapPlayheadToVisibleWindowStart,
  );
  const setLayerRepeatUnit = useMidiStore((s) => s.setLayerRepeatUnit);
  const toggleLayerRepeatEvery = useMidiStore((s) => s.toggleLayerRepeatEvery);
  const setLayerLoopStartMeasure = useMidiStore((s) => s.setLayerLoopStartMeasure);
  const setLayerLoopRepeatEndMeasure = useMidiStore(
    (s) => s.setLayerLoopRepeatEndMeasure,
  );
  const setOctaveView = useMidiStore((s) => s.setOctaveView);
  const shiftLayerLoopNotesOctave = useMidiStore((s) => s.shiftLayerLoopNotesOctave);
  const addCompositionMeasure = useMidiStore((s) => s.addCompositionMeasure);
  const removeLastCompositionMeasure = useMidiStore((s) => s.removeLastCompositionMeasure);
  const clearPersistedSession = useMidiStore((s) => s.clearPersistedSession);
  const metrics = getTimelineMetrics(meter, masterLoopLength, midiMeasuresVisible);
  const nowMeasure = Math.min(
    metrics.measureCount,
    Math.floor(midiPlayheadBeat / metrics.beatsPerMeasure) + 1,
  );
  const selectedLayerData = layers[selectedLayerId];
  const editorFocus = selectedLoopFocusByLayer[selectedLayerId];
  const activeLoop =
    selectedLayerData != null
      ? activeLayerLoopForEditorFocus(selectedLayerData, definitions, editorFocus)
      : null;
  const repeatPhraseEnabled = midiNoteSelection != null;
  const repeatPlacementEnabled = repeatPhraseEnabled && midiLoopEditMode == null;
  const repeatEvery = repeatEveryForUnit(
    activeLoop ?? {
      repeatUnit: "measures",
      repeatEveryMeasuresMemory: null,
      repeatEveryBeatsMemory: null,
    },
  );
  const canRemoveLastMeasure = metrics.measureCount >= 2;

  return (
    <main className="app-wrap">
      {import.meta.env.DEV && <DevToolbar onClearSavedState={clearPersistedSession} />}
      <TransportRunner />
      <section className="screen">
        <TopBar
          isPlaying={isPlaying}
          bpm={bpm}
          keyName={keyName}
          meter={meter}
          octaveView={octaveView}
          nowMeasure={nowMeasure}
          nowMeasureCount={metrics.measureCount}
          selectedLayerId={selectedLayerId}
          onOpenHook={() => setShowHookModal(true)}
          onSetBpm={setBpm}
          onSetKey={setKey}
          onSetOctaveView={setOctaveView}
        />
        <div className="main">
          <div className="main-top">
            <SoftPot selectedLayer={selectedLayerId} octave={octaveView} />
            <WorkspacePanel />
          </div>
          <div className="composition-row">
            <CompositionView />
          </div>
        </div>
        <BottomControls
          isPlaying={isPlaying}
          addOn={addOn}
          beatsPerMeasure={metrics.beatsPerMeasure}
          totalMeasures={metrics.measureCount}
          activeLoop={activeLoop}
          repeatPhraseEnabled={repeatPhraseEnabled}
          repeatPlacementEnabled={repeatPlacementEnabled}
          phraseFieldSyncKey={`${selectedLayerId}-${activeLoop?.loopId ?? "loop"}-${activeLoop?.repeatUnit ?? "measures"}-${activeLoop?.repeatEveryMeasuresMemory ?? "none"}-${activeLoop?.repeatEveryBeatsMemory ?? "none"}-${midiNoteSelection?.loopId ?? ""}`}
          onTogglePlay={togglePlaying}
          onRestartTransport={restartTransportFromStart}
          onRestartPlayheadInView={snapPlayheadToVisibleWindowStart}
          onToggleAdd={toggleAddOn}
          onShiftLoopNotesOctave={(delta) => shiftLayerLoopNotesOctave(selectedLayerId, delta)}
          onAddMeasure={addCompositionMeasure}
          onRemoveLastMeasure={removeLastCompositionMeasure}
          canRemoveLastMeasure={canRemoveLastMeasure}
          onSetRepeatUnit={(value) => setLayerRepeatUnit(selectedLayerId, value)}
          onToggleRepeatEvery={(value) => toggleLayerRepeatEvery(selectedLayerId, value)}
          onSetStartMeasure={(value) => setLayerLoopStartMeasure(selectedLayerId, value)}
          onSetRepeatEndMeasure={(value) => setLayerLoopRepeatEndMeasure(selectedLayerId, value)}
        />
      </section>
      {showHookModal && <MakeHookModal onClose={() => setShowHookModal(false)} />}
    </main>
  );
}
