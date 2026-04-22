import { useState } from "react";
import BottomControls from "./components/BottomControls";
import CompositionView from "./components/CompositionView";
import DevToolbar from "./components/app/DevToolbar";
import WorkspacePanel from "./components/app/WorkspacePanel";
import MakeHookModal from "./components/MakeHookModal";
import TransportRunner from "./components/TransportRunner";
import SoftPot from "./components/SoftPot";
import TopBar from "./components/TopBar";
import {
  useActiveLoopContext,
  useAppShellActions,
  useAppShellState,
  useCompositionTiming,
} from "./store/hooks";

export default function App() {
  const [showHookModal, setShowHookModal] = useState(false);
  const {
    isPlaying,
    addOn,
    bpm,
    keyName,
    meter,
    selectedLayer,
    midiNoteSelection,
    octaveView,
  } = useAppShellState();
  const {
    togglePlaying,
    restartTransportFromStart,
    snapPlayheadToVisibleWindowStart,
    toggleAddOn,
    setLayerRepeatUnit,
    toggleLayerRepeatEvery,
    setLayerLoopStartMeasure,
    setLayerLoopRepeatEndMeasure,
    setOctaveView,
    shiftLayerLoopNotesOctave,
    addCompositionMeasure,
    removeLastCompositionMeasure,
    setBpm,
    setKey,
    clearPersistedSession,
  } = useAppShellActions();
  const { measureCount: layerMeasureCount, beatsPerMeasure, nowMeasure, canRemoveLastMeasure } =
    useCompositionTiming();
  const { activeLoop, repeatPhraseEnabled, repeatPlacementEnabled } =
    useActiveLoopContext();

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
          nowMeasureCount={layerMeasureCount}
          selectedLayerId={selectedLayer}
          onOpenHook={() => setShowHookModal(true)}
          onSetBpm={setBpm}
          onSetKey={setKey}
          onSetOctaveView={setOctaveView}
        />
        <div className="main">
          <div className="main-top">
            <SoftPot selectedLayer={selectedLayer} octave={octaveView} />
            <WorkspacePanel />
          </div>
          <div className="composition-row">
            <CompositionView />
          </div>
        </div>
        <BottomControls
          isPlaying={isPlaying}
          addOn={addOn}
          beatsPerMeasure={beatsPerMeasure}
          totalMeasures={layerMeasureCount}
          activeLoop={activeLoop}
          repeatPhraseEnabled={repeatPhraseEnabled}
          repeatPlacementEnabled={repeatPlacementEnabled}
          phraseFieldSyncKey={`${selectedLayer}-${activeLoop?.id ?? "loop"}-${activeLoop?.repeatUnit ?? "measures"}-${activeLoop?.repeatEveryMeasuresMemory ?? "none"}-${activeLoop?.repeatEveryBeatsMemory ?? "none"}-${midiNoteSelection?.loopId ?? ""}`}
          onTogglePlay={togglePlaying}
          onRestartTransport={restartTransportFromStart}
          onRestartPlayheadInView={snapPlayheadToVisibleWindowStart}
          onToggleAdd={toggleAddOn}
          onShiftLoopNotesOctave={(delta) => shiftLayerLoopNotesOctave(selectedLayer, delta)}
          onAddMeasure={addCompositionMeasure}
          onRemoveLastMeasure={removeLastCompositionMeasure}
          canRemoveLastMeasure={canRemoveLastMeasure}
          onSetRepeatUnit={(value) => setLayerRepeatUnit(selectedLayer, value)}
          onToggleRepeatEvery={(value) => toggleLayerRepeatEvery(selectedLayer, value)}
          onSetStartMeasure={(value) => setLayerLoopStartMeasure(selectedLayer, value)}
          onSetRepeatEndMeasure={(value) => setLayerLoopRepeatEndMeasure(selectedLayer, value)}
        />
      </section>
      {showHookModal && <MakeHookModal onClose={() => setShowHookModal(false)} />}
    </main>
  );
}
