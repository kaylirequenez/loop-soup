import LayerList from "../LayerList";
import MidiMeasureNav from "../MidiMeasureNav";
import MidiRoll from "../MidiRoll";
import SoundPicker from "../SoundPicker";
import { useMidiStore } from "../../store/midiStore";
import { useLayerStore } from "../../store/layerStore";
import { useLayerEditorStore } from "../../store/layerEditorStore";
import { useLayerPlaybackStore } from "../../store/layerPlaybackStore";
import { useTransportStore } from "../../store/transportStore";
import { deriveMidiLayerRollMenuFromLoops } from "../../store/utils/midiPlacement";
import { getTimelineMetrics } from "../../store/utils/timeline";
import { oneBasedRange } from "../../lib/range";
import { LAYER_ORDER } from "../../lib/layers";
import type { LayerId, LayersState } from "../../types/layer";

const MIDI_MENU_LAYER_ROLL_OPTS = [
  { key: "1", value: "1", label: "1", title: "Show this layer on roll 1 only" },
  { key: "2", value: "2", label: "2", title: "Show this layer on roll 2 only" },
  { key: "both", value: "both", label: "1+2", title: "Show this layer on both rolls" },
] as const;
const MAX_MIDI_MEASURES_VISIBLE_OPTION = 4;

function LayerPane(props: {
  selectedLayer: LayerId;
  onSelectLayer: (id: LayerId) => void;
  onToggleLayerMute: (id: LayerId) => void;
  onToggleLayerSolo: (id: LayerId) => void;
  soloLayerId: LayerId | null;
  layers: LayersState;
}) {
  return <LayerList {...props} />;
}

export default function WorkspacePanel() {
  const currentView = useMidiStore((s) => s.currentView);
  const setView = useMidiStore((s) => s.setView);
  const midiMenuOpen = useMidiStore((s) => s.midiMenuOpen);
  const toggleMidiMenuOpen = useMidiStore((s) => s.toggleMidiMenuOpen);
  const midiRollSplitByRootOctave = useMidiStore((s) => s.midiRollSplitByRootOctave);
  const midiRollCount = useMidiStore((s) => s.midiRollCount);
  const toggleSecondRoll = useMidiStore((s) => s.toggleSecondRoll);
  const setSplitByRootOctaveEnabled = useMidiStore((s) => s.setSplitByRootOctaveEnabled);
  const midiMeasuresVisible = useMidiStore((s) => s.midiMeasuresVisible);
  const setMidiMeasuresVisible = useMidiStore((s) => s.setMidiMeasuresVisible);
  const layers = useLayerStore((s) => s.layers);
  const selectedLayer = useLayerEditorStore((s) => s.selectedLayerId);
  const toggleLayerMute = useLayerPlaybackStore((s) => s.toggleLayerMute);
  const toggleLayerSolo = useLayerPlaybackStore((s) => s.toggleLayerSolo);
  const soloLayerId = useLayerPlaybackStore((s) => s.soloLayerId);
  const midiLoopRollPlacement = useMidiStore((s) => s.midiLoopRollPlacement);
  const setMidiLayerRollPlacement = useMidiStore((s) => s.setMidiLayerRollPlacement);
  const pickerOpen = useMidiStore((s) => s.pickerOpen);
  const togglePickerOpen = useMidiStore((s) => s.togglePickerOpen);
  const sampleSoundOn = useMidiStore((s) => s.sampleSoundOn);
  const setSampleSoundOn = useMidiStore((s) => s.setSampleSoundOn);
  const selectLayer = useMidiStore((s) => s.selectLayer);
  const meter = useTransportStore((s) => s.meter);
  const masterLoopLength = useTransportStore((s) => s.masterLoopLength);
  const showLayers = currentView === "layers" || currentView === "dual";
  const showMidi = currentView === "midi" || currentView === "dual";
  const dualView = currentView === "dual";
  const { measureCount: layerMeasureCount } = getTimelineMetrics(
    meter,
    masterLoopLength,
    midiMeasuresVisible,
  );
  const showStackedRoll = midiRollCount === 2;
  const rollPlacementMenuEnabled = showStackedRoll && !midiRollSplitByRootOctave;

  return (
    <div className="right">
      <div className="view-bar">
        <button className={`vb ${currentView === "layers" ? "vb-on" : ""}`} onClick={() => setView("layers")}>layers</button>
        <button className={`vb ${currentView === "midi" ? "vb-on" : ""}`} onClick={() => setView("midi")}>midi roll</button>
        <button className={`vb ${currentView === "dual" ? "vb-on" : ""}`} onClick={() => setView("dual")}>dual</button>
        {showMidi && <MidiMeasureNav currentView={currentView} />}
        <div className="view-bar-right-controls">
          {showMidi && (
            <div className="midi-menu-anchor">
              <button
                className={`midi-panel-toggle ${midiMenuOpen ? "midi-panel-toggle-on" : ""}`}
                onClick={toggleMidiMenuOpen}
              >
                midi menu
              </button>
              {midiMenuOpen && (
                <aside className="midi-roll-menu midi-roll-menu-dropdown">
                  <div className="midi-menu-section">
                    <button
                      type="button"
                      className="midi-menu-btn"
                      disabled={midiRollSplitByRootOctave}
                      title={
                        midiRollSplitByRootOctave
                          ? "Turn off root/octave split to add or remove the second roll manually"
                          : undefined
                      }
                      onClick={() => {
                        if (showStackedRoll) {
                          toggleSecondRoll();
                          return;
                        }
                        setSplitByRootOctaveEnabled(false);
                        toggleSecondRoll();
                      }}
                    >
                      {showStackedRoll ? "remove roll 2" : "add roll 2"}
                    </button>
                  </div>
                  <div className="midi-menu-section">
                    <div className="midi-menu-title">measures shown</div>
                    <div className="midi-measures-shown-grid">
                      {oneBasedRange(MAX_MIDI_MEASURES_VISIBLE_OPTION).map((n) => {
                        const tooMany = n > layerMeasureCount;
                        const isOn =
                          n === Math.min(midiMeasuresVisible, layerMeasureCount, MAX_MIDI_MEASURES_VISIBLE_OPTION);
                        return (
                          <button
                            key={n}
                            type="button"
                            className={`midi-menu-btn ${isOn ? "midi-menu-btn-on" : ""}`}
                            disabled={tooMany}
                            title={tooMany ? `Composition has only ${layerMeasureCount} measure${layerMeasureCount === 1 ? "" : "s"}` : undefined}
                            onClick={() => setMidiMeasuresVisible(n)}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="midi-menu-section">
                    <div className="midi-menu-title">layers in MIDI rolls</div>
                    {rollPlacementMenuEnabled ? (
                      <div className="midi-layer-roll-list">
                        {LAYER_ORDER.map((layerId) => {
                          const pl = deriveMidiLayerRollMenuFromLoops(layers, midiLoopRollPlacement, layerId);
                          return (
                            <div className="midi-layer-roll-row" key={layerId}>
                              <span className="midi-layer-roll-id">{layerId}</span>
                              <div className="midi-layer-roll-pick" role="group" aria-label={`MIDI rolls for layer ${layerId}`}>
                                {MIDI_MENU_LAYER_ROLL_OPTS.map((opt) => (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    className={`comp-roll-placement-btn ${pl != null && pl === opt.value ? "comp-roll-placement-btn--on" : ""}`}
                                    title={opt.title}
                                    aria-pressed={pl != null && pl === opt.value}
                                    onClick={() => setMidiLayerRollPlacement(layerId, opt.value)}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="midi-menu-hint">
                        {midiRollSplitByRootOctave
                          ? "Rolls are split by pitch (root & octave). Turn off split to assign layers manually."
                          : "Add a second roll to choose which layers appear on each roll."}
                      </p>
                    )}
                  </div>
                  <div className="midi-menu-section">
                    <button
                      type="button"
                      className={`midi-menu-btn ${midiRollSplitByRootOctave ? "midi-menu-btn-on" : ""}`}
                      onClick={() => {
                        if (midiRollSplitByRootOctave) {
                          setSplitByRootOctaveEnabled(false);
                          return;
                        }
                        setSplitByRootOctaveEnabled(true);
                      }}
                      title="Top roll if the note’s stored octave (badge) is ≥ the top-bar octave; otherwise bottom."
                    >
                      split by root & octave
                    </button>
                  </div>
                </aside>
              )}
            </div>
          )}
          <button className={`sounds-toggle ${pickerOpen ? "sounds-toggle-on" : ""}`} onClick={togglePickerOpen}>
            {pickerOpen ? "sounds ✕" : "sounds ▸"}
          </button>
        </div>
      </div>

      <div className="mid-area">
        {dualView ? (
          <div className="dual-view">
            <div className="layers-view dual-pane dual-pane-midi">
              <MidiRoll />
            </div>
            <div className="layers-view dual-pane">
              <LayerPane
                selectedLayer={selectedLayer}
                onSelectLayer={selectLayer}
                onToggleLayerMute={toggleLayerMute}
                onToggleLayerSolo={toggleLayerSolo}
                soloLayerId={soloLayerId}
                layers={layers}
              />
            </div>
          </div>
        ) : showLayers ? (
          <div className="layers-view">
            <LayerPane
              selectedLayer={selectedLayer}
              onSelectLayer={selectLayer}
              onToggleLayerMute={toggleLayerMute}
              onToggleLayerSolo={toggleLayerSolo}
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
  );
}
