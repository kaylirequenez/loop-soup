import BottomControls from "./components/BottomControls";
import CompositionView from "./components/CompositionView";
import LayerList from "./components/LayerList";
import MakeHookModal from "./components/MakeHookModal";
import MidiRoll from "./components/MidiRoll";
import SoftPot from "./components/SoftPot";
import SoundPicker from "./components/SoundPicker";
import { useAppStore } from "./store/appStore";
import TopBar from "./components/TopBar";
import { useState } from "react";

export default function App() {
  const [showHookModal, setShowHookModal] = useState(false);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const addOn = useAppStore((s) => s.addOn);
  const extendOn = useAppStore((s) => s.extendOn);
  const currentLoop = useAppStore((s) => s.currentLoop);
  const totalLoops = useAppStore((s) => s.totalLoops);
  const bpm = useAppStore((s) => s.bpm);
  const keyName = useAppStore((s) => s.key);
  const meter = useAppStore((s) => s.meter);
  const masterLoopLength = useAppStore((s) => s.masterLoopLength);
  const selectedLayer = useAppStore((s) => s.selectedLayer);
  const currentView = useAppStore((s) => s.currentView);
  const pickerOpen = useAppStore((s) => s.pickerOpen);
  const layers = useAppStore((s) => s.layers);
  const sampleSoundOn = useAppStore((s) => s.sampleSoundOn);
  const togglePlaying = useAppStore((s) => s.togglePlaying);
  const toggleAddOn = useAppStore((s) => s.toggleAddOn);
  const toggleExtendOn = useAppStore((s) => s.toggleExtendOn);
  const setView = useAppStore((s) => s.setView);
  const togglePickerOpen = useAppStore((s) => s.togglePickerOpen);
  const midiMenuOpen = useAppStore((s) => s.midiMenuOpen);
  const toggleMidiMenuOpen = useAppStore((s) => s.toggleMidiMenuOpen);
  const selectLayer = useAppStore((s) => s.selectLayer);
  const setLayerRepeat = useAppStore((s) => s.setLayerRepeat);
  const setLayerOctave = useAppStore((s) => s.setLayerOctave);
  const toggleLayerMute = useAppStore((s) => s.toggleLayerMute);
  const toggleLayerSolo = useAppStore((s) => s.toggleLayerSolo);
  const addLayerKnob = useAppStore((s) => s.addLayerKnob);
  const soloLayerId = useAppStore((s) => s.soloLayerId);
  const setSampleSoundOn = useAppStore((s) => s.setSampleSoundOn);
  const selectedLayerData = layers[selectedLayer];
  const repeat = selectedLayerData?.repeat ?? 1;
  const octave = selectedLayerData?.octave ?? 4;
  const showLayers = currentView === "layers" || currentView === "dual";
  const showMidi = currentView === "midi" || currentView === "dual";
  const dualView = currentView === "dual";

  return (
    <main className="app-wrap">
      {import.meta.env.DEV && (
        <div className="dev-toolbar">
          <button onClick={togglePlaying}>play/pause</button>
          <button onClick={toggleAddOn}>toggle add</button>
          <button onClick={togglePickerOpen}>sound picker</button>
          <button onClick={() => setView("layers")}>layers</button>
          <button onClick={() => setView("midi")}>midi roll</button>
          <button onClick={() => setSampleSoundOn(!sampleSoundOn)}>
            sample toggle
          </button>
          <button onClick={toggleExtendOn}>extend</button>
        </div>
      )}
      <section className="screen">
        <TopBar
          isPlaying={isPlaying}
          bpm={bpm}
          keyName={keyName}
          meter={meter}
          loopLength={masterLoopLength ?? 0}
          onOpenHook={() => setShowHookModal(true)}
          currentLoop={currentLoop}
          totalLoops={totalLoops}
        />

        <div className="main">
          <div className="main-top">
            <SoftPot selectedLayer={selectedLayer} octave={octave} />

            <div className="right">
              <div className="view-bar">
                <button
                  className={`vb ${currentView === "layers" ? "vb-on" : ""}`}
                  onClick={() => setView("layers")}
                >
                  layers
                </button>
                <button
                  className={`vb ${currentView === "midi" ? "vb-on" : ""}`}
                  onClick={() => setView("midi")}
                >
                  midi roll
                </button>
                <button
                  className={`vb ${currentView === "dual" ? "vb-on" : ""}`}
                  onClick={() => setView("dual")}
                >
                  dual
                </button>
                {showMidi && (
                  <button
                    className={`midi-panel-toggle ${midiMenuOpen ? "midi-panel-toggle-on" : ""}`}
                    onClick={toggleMidiMenuOpen}
                  >
                    midi menu
                  </button>
                )}
                <button
                  className={`sounds-toggle ${pickerOpen ? "sounds-toggle-on" : ""} ${!showMidi ? "sounds-toggle-right" : ""}`}
                  onClick={togglePickerOpen}
                >
                  {pickerOpen ? "sounds ✕" : "sounds ▸"}
                </button>
              </div>

              <div className="mid-area">
                {dualView ? (
                  <div className="dual-view">
                    <div className="layers-view dual-pane dual-pane-midi">
                      <MidiRoll />
                    </div>
                    <div className="layers-view dual-pane">
                      <LayerList
                        selectedLayer={selectedLayer}
                        onSelectLayer={selectLayer}
                        onToggleLayerMute={toggleLayerMute}
                        onToggleLayerSolo={toggleLayerSolo}
                        onAddLayerKnob={addLayerKnob}
                        soloLayerId={soloLayerId}
                        layers={layers}
                      />
                    </div>
                  </div>
                ) : showLayers ? (
                  <div className="layers-view">
                    <LayerList
                      selectedLayer={selectedLayer}
                      onSelectLayer={selectLayer}
                      onToggleLayerMute={toggleLayerMute}
                      onToggleLayerSolo={toggleLayerSolo}
                      onAddLayerKnob={addLayerKnob}
                      soloLayerId={soloLayerId}
                      layers={layers}
                    />
                  </div>
                ) : (
                  <div className="layers-view layers-view-midi">
                    <MidiRoll />
                  </div>
                )}

                <SoundPicker
                  selectedLayer={selectedLayer}
                  open={pickerOpen}
                  sampleSoundOn={sampleSoundOn}
                  onToggleSample={() => setSampleSoundOn(!sampleSoundOn)}
                />

              </div>
            </div>
          </div>

          <div className="composition-row">
            <CompositionView
              currentLoop={currentLoop}
              totalLoops={totalLoops}
            />
          </div>
        </div>

        <BottomControls
          isPlaying={isPlaying}
          addOn={addOn}
          extendOn={extendOn}
          repeat={repeat}
          octave={octave}
          onTogglePlay={togglePlaying}
          onToggleAdd={toggleAddOn}
          onToggleExtend={toggleExtendOn}
          onSetRepeat={(value) => setLayerRepeat(selectedLayer, value)}
          onSetOctave={(value) => setLayerOctave(selectedLayer, value)}
        />
      </section>

      {showHookModal && (
        <MakeHookModal onClose={() => setShowHookModal(false)} />
      )}
    </main>
  );
}
