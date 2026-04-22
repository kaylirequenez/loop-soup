import BottomControls from "./components/BottomControls";
import CompositionView from "./components/CompositionView";
import DevToolbar from "./components/app/DevToolbar";
import WorkspacePanel from "./components/app/WorkspacePanel";
import MakeHookModal from "./components/MakeHookModal";
import TransportRunner from "./components/TransportRunner";
import SoftPot from "./components/SoftPot";
import { useAppStore } from "./store/appStore";
import TopBar from "./components/TopBar";
import { useState } from "react";
import {
  beatsPerMeasureFromMeter,
  compositionLoopBeatLength,
  readMidiCompositionBeat,
} from "./lib/midiPlayhead";

export default function App() {
  const [showHookModal, setShowHookModal] = useState(false);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const addOn = useAppStore((s) => s.addOn);
  const bpm = useAppStore((s) => s.bpm);
  const keyName = useAppStore((s) => s.key);
  const meter = useAppStore((s) => s.meter);
  const selectedLayer = useAppStore((s) => s.selectedLayer);
  const currentView = useAppStore((s) => s.currentView);
  const pickerOpen = useAppStore((s) => s.pickerOpen);
  const midiMenuOpen = useAppStore((s) => s.midiMenuOpen);
  const midiRollCount = useAppStore((s) => s.midiRollCount);
  const midiMeasuresVisible = useAppStore((s) => s.midiMeasuresVisible);
  const layers = useAppStore((s) => s.layers);
  const midiLoopRollPlacement = useAppStore((s) => s.midiLoopRollPlacement);
  const midiNoteSelection = useAppStore((s) => s.midiNoteSelection);
  const midiLoopEditMode = useAppStore((s) => s.midiLoopEditMode);
  const sampleSoundOn = useAppStore((s) => s.sampleSoundOn);
  const togglePlaying = useAppStore((s) => s.togglePlaying);
  const restartTransportFromStart = useAppStore(
    (s) => s.restartTransportFromStart,
  );
  const restartPlayheadToViewWindowStart = useAppStore(
    (s) => s.restartPlayheadToViewWindowStart,
  );
  const toggleAddOn = useAppStore((s) => s.toggleAddOn);
  const setView = useAppStore((s) => s.setView);
  const togglePickerOpen = useAppStore((s) => s.togglePickerOpen);
  const toggleMidiMenuOpen = useAppStore((s) => s.toggleMidiMenuOpen);
  const setMidiRollCount = useAppStore((s) => s.setMidiRollCount);
  const midiRollSplitByRootOctave = useAppStore(
    (s) => s.midiRollSplitByRootOctave,
  );
  const setMidiRollSplitByRootOctave = useAppStore(
    (s) => s.setMidiRollSplitByRootOctave,
  );
  const setMidiLayerRollPlacement = useAppStore(
    (s) => s.setMidiLayerRollPlacement,
  );
  const setMidiMeasuresVisible = useAppStore((s) => s.setMidiMeasuresVisible);
  const selectLayer = useAppStore((s) => s.selectLayer);
  const setLayerRepeatUnit = useAppStore((s) => s.setLayerRepeatUnit);
  const toggleLayerRepeatEvery = useAppStore((s) => s.toggleLayerRepeatEvery);
  const setLayerLoopStartMeasure = useAppStore((s) => s.setLayerLoopStartMeasure);
  const setLayerLoopRepeatEndMeasure = useAppStore(
    (s) => s.setLayerLoopRepeatEndMeasure,
  );
  const octaveView = useAppStore((s) => s.octaveView);
  const setOctaveView = useAppStore((s) => s.setOctaveView);
  const shiftLayerLoopNotesOctave = useAppStore(
    (s) => s.shiftLayerLoopNotesOctave,
  );
  const masterLoopLength = useAppStore((s) => s.masterLoopLength);
  const addCompositionMeasure = useAppStore((s) => s.addCompositionMeasure);
  const removeLastCompositionMeasure = useAppStore(
    (s) => s.removeLastCompositionMeasure,
  );
  const midiPlayheadBeat = useAppStore((s) => s.midiPlayheadBeat);
  const toggleLayerMute = useAppStore((s) => s.toggleLayerMute);
  const toggleLayerSolo = useAppStore((s) => s.toggleLayerSolo);
  const addLayerKnob = useAppStore((s) => s.addLayerKnob);
  const soloLayerId = useAppStore((s) => s.soloLayerId);
  const setSampleSoundOn = useAppStore((s) => s.setSampleSoundOn);
  const setBpm = useAppStore((s) => s.setBpm);
  const setKey = useAppStore((s) => s.setKey);
  const clearPersistedSession = useAppStore((s) => s.clearPersistedSession);
  const selectedLayerData = layers[selectedLayer];
  const activeLoopIndex = Math.min(
    Math.max(0, (selectedLayerData?.loops?.length ?? 1) - 1),
    selectedLayerData?.activeLoopIndex ?? 0,
  );
  const activeLoop = selectedLayerData?.loops?.[activeLoopIndex] ?? null;
  const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
  const compositionBeats = compositionLoopBeatLength(
    masterLoopLength,
    beatsPerMeasure,
  );
  const layerBeat = readMidiCompositionBeat(midiPlayheadBeat, compositionBeats);
  const layerMeasureCount = Math.max(
    1,
    Math.ceil(compositionBeats / beatsPerMeasure),
  );
  const nowMeasure = Math.min(
    layerMeasureCount,
    Math.floor(layerBeat / beatsPerMeasure) + 1,
  );
  const canRemoveLastMeasure = layerMeasureCount >= 2;
  const showLayers = currentView === "layers" || currentView === "dual";
  const showMidi = currentView === "midi" || currentView === "dual";
  const dualView = currentView === "dual";
  const showStackedRoll = midiRollCount === 2;
  const rollPlacementMenuEnabled = showStackedRoll && !midiRollSplitByRootOctave;
  /** Repeat/phrase unlock after tapping a note; edits that layer’s `activeLoop`. */
  const repeatPhraseEnabled = midiNoteSelection != null;
  const repeatPlacementEnabled = repeatPhraseEnabled && midiLoopEditMode == null;

  return (
    <main className="app-wrap">
      {import.meta.env.DEV && (
        <DevToolbar
          onTogglePlay={togglePlaying}
          onToggleAdd={toggleAddOn}
          onTogglePicker={togglePickerOpen}
          onSetView={setView}
          sampleSoundOn={sampleSoundOn}
          onSetSampleSoundOn={setSampleSoundOn}
          onClearSavedState={clearPersistedSession}
        />
      )}
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

            <WorkspacePanel
              currentView={currentView}
              onSetView={setView}
              showMidi={showMidi}
              midiMenuOpen={midiMenuOpen}
              onToggleMidiMenuOpen={toggleMidiMenuOpen}
              midiRollSplitByRootOctave={midiRollSplitByRootOctave}
              showStackedRoll={showStackedRoll}
              onSetMidiRollCount={setMidiRollCount}
              onSetMidiRollSplitByRootOctave={setMidiRollSplitByRootOctave}
              layerMeasureCount={layerMeasureCount}
              midiMeasuresVisible={midiMeasuresVisible}
              onSetMidiMeasuresVisible={setMidiMeasuresVisible}
              rollPlacementMenuEnabled={rollPlacementMenuEnabled}
              layers={layers}
              midiLoopRollPlacement={midiLoopRollPlacement}
              onSetMidiLayerRollPlacement={setMidiLayerRollPlacement}
              pickerOpen={pickerOpen}
              onTogglePickerOpen={togglePickerOpen}
              sampleSoundOn={sampleSoundOn}
              onSetSampleSoundOn={setSampleSoundOn}
              dualView={dualView}
              showLayers={showLayers}
              selectedLayer={selectedLayer}
              onSelectLayer={selectLayer}
              onToggleLayerMute={toggleLayerMute}
              onToggleLayerSolo={toggleLayerSolo}
              onAddLayerKnob={addLayerKnob}
              soloLayerId={soloLayerId}
            />
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
          phraseFieldSyncKey={`${selectedLayer}-${activeLoop?.id ?? "loop"}-${activeLoop?.repeatUnit ?? "measures"}-${activeLoop?.repeatEvery ?? "none"}-${midiNoteSelection?.noteKey ?? ""}`}
          onTogglePlay={togglePlaying}
          onRestartTransport={restartTransportFromStart}
          onRestartPlayheadInView={restartPlayheadToViewWindowStart}
          onToggleAdd={toggleAddOn}
          onShiftLoopNotesOctave={(delta) =>
            shiftLayerLoopNotesOctave(selectedLayer, delta)
          }
          onAddMeasure={addCompositionMeasure}
          onRemoveLastMeasure={removeLastCompositionMeasure}
          canRemoveLastMeasure={canRemoveLastMeasure}
          onSetRepeatUnit={(value) => setLayerRepeatUnit(selectedLayer, value)}
          onToggleRepeatEvery={(value) =>
            toggleLayerRepeatEvery(selectedLayer, value)
          }
          onSetStartMeasure={(value) =>
            setLayerLoopStartMeasure(selectedLayer, value)
          }
          onSetRepeatEndMeasure={(value) =>
            setLayerLoopRepeatEndMeasure(selectedLayer, value)
          }
        />
      </section>

      {showHookModal && (
        <MakeHookModal onClose={() => setShowHookModal(false)} />
      )}
    </main>
  );
}
