// TODO: split this into multiple files & rename to be better
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import LayerCard from "./LayerCard";
import MidiMeasureNav from "./MidiMeasureNav";
import MidiRoll from "./MidiRoll";
import SoundPicker from "./SoundPicker";
import { useMidiStore } from "../store/midiStore";
import { useLayerStore } from "../store/layerStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useCompositionStore } from "../store/compositionStore";
import { oneBasedRange } from "../utils";
import type { AppView } from "../types/app";
import type { LayerId } from "../types/layer";

const MIDI_MENU_LAYER_ROLL_OPTS = [
  { key: "1", value: "1", label: "1", title: "Show this layer on roll 1 only" },
  { key: "2", value: "2", label: "2", title: "Show this layer on roll 2 only" },
  {
    key: "both",
    value: "both",
    label: "1+2",
    title: "Show this layer on both rolls",
  },
] as const;
const MAX_MIDI_MEASURES_VISIBLE_OPTION = 4;

function LayerPane() {
  const layers = useLayerStore((s) => s.layers);
  return (
    <div className="layers-scroll">
      {(Object.keys(layers) as LayerId[]).map((layerId) => (
        <LayerCard key={layerId} layerId={layerId} />
      ))}
    </div>
  );
}

export default function WorkspacePanel() {
  const [currentView, setCurrentView] = useState<AppView>("layers");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [midiMenuOpen, setMidiMenuOpen] = useState(false);
  const [sampleSoundOn, setSampleSoundOn] = useState(true);

  const {
    midiRollSplitByRootOctave,
    midiRollCount,
    toggleSecondRoll,
    setMidiRollSplitByRootOctave,
    midiMeasuresVisible,
    setMidiMeasuresVisible,
    midiLayerPlacement,
    setMidiLayerRollPlacement,
  } = useMidiStore(
    useShallow((s) => ({
      midiRollSplitByRootOctave: s.midiRollSplitByRootOctave,
      midiRollCount: s.midiRollCount,
      toggleSecondRoll: s.toggleSecondRoll,
      setMidiRollSplitByRootOctave: s.setMidiRollSplitByRootOctave,
      midiMeasuresVisible: s.midiMeasuresVisible,
      setMidiMeasuresVisible: s.setMidiMeasuresVisible,
      midiLayerPlacement: s.midiLayerPlacement,
      setMidiLayerRollPlacement: s.setMidiLayerRollPlacement,
    })),
  );
  const layers = useLayerStore((s) => s.layers);
  const { selectedLayerId } = useLayerEditorStore(
    useShallow((s) => ({
      selectedLayerId: s.selectedLayerId,
    })),
  );
  const { totalMeasures } = useCompositionStore(
    useShallow((s) => ({
      totalMeasures: s.totalMeasures,
    })),
  );

  const showLayers = currentView === "layers" || currentView === "dual";
  const showMidi = currentView === "midi" || currentView === "dual";
  const dualView = currentView === "dual";
  const showStackedRoll = midiRollCount === 2;
  const rollPlacementMenuEnabled =
    showStackedRoll && !midiRollSplitByRootOctave;

  return (
    <div className="right">
      <div className="view-bar">
        <button
          className={`vb ${currentView === "layers" ? "vb-on" : ""}`}
          onClick={() => setCurrentView("layers")}
        >
          layers
        </button>
        <button
          className={`vb ${currentView === "midi" ? "vb-on" : ""}`}
          onClick={() => setCurrentView("midi")}
        >
          midi roll
        </button>
        <button
          className={`vb ${currentView === "dual" ? "vb-on" : ""}`}
          onClick={() => setCurrentView("dual")}
        >
          dual
        </button>
        {showMidi && <MidiMeasureNav currentView={currentView} />}
        <div className="view-bar-right-controls">
          {showMidi && (
            <div className="midi-menu-anchor">
              <button
                className={`midi-panel-toggle ${midiMenuOpen ? "midi-panel-toggle-on" : ""}`}
                onClick={() => setMidiMenuOpen((v) => !v)}
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
                        setMidiRollSplitByRootOctave(false);
                        toggleSecondRoll();
                      }}
                    >
                      {showStackedRoll ? "remove roll 2" : "add roll 2"}
                    </button>
                  </div>
                  <div className="midi-menu-section">
                    <div className="midi-menu-title">measures shown</div>
                    <div className="midi-measures-shown-grid">
                      {oneBasedRange(MAX_MIDI_MEASURES_VISIBLE_OPTION).map(
                        (n) => {
                          const tooMany = n > totalMeasures;
                          const isOn =
                            n ===
                            Math.min(
                              midiMeasuresVisible,
                              totalMeasures,
                              MAX_MIDI_MEASURES_VISIBLE_OPTION,
                            );
                          return (
                            <button
                              key={n}
                              type="button"
                              className={`midi-menu-btn ${isOn ? "midi-menu-btn-on" : ""}`}
                              disabled={tooMany}
                              title={
                                tooMany
                                  ? `Composition has only ${totalMeasures} measure${totalMeasures === 1 ? "" : "s"}`
                                  : undefined
                              }
                              onClick={() => setMidiMeasuresVisible(n)}
                            >
                              {n}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </div>
                  <div className="midi-menu-section">
                    <div className="midi-menu-title">layers in MIDI rolls</div>
                    {rollPlacementMenuEnabled ? (
                      <div className="midi-layer-roll-list">
                        {(Object.keys(layers) as LayerId[]).map((layerId) => {
                          const pl = midiLayerPlacement[layerId];
                          return (
                            <div className="midi-layer-roll-row" key={layerId}>
                              <span className="midi-layer-roll-id">
                                {layerId}
                              </span>
                              <div
                                className="midi-layer-roll-pick"
                                role="group"
                                aria-label={`MIDI rolls for layer ${layerId}`}
                              >
                                {MIDI_MENU_LAYER_ROLL_OPTS.map((opt) => (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    className={`comp-roll-placement-btn ${pl != null && pl === opt.value ? "comp-roll-placement-btn--on" : ""}`}
                                    title={opt.title}
                                    aria-pressed={
                                      pl != null && pl === opt.value
                                    }
                                    onClick={() =>
                                      setMidiLayerRollPlacement(
                                        layerId,
                                        opt.value,
                                      )
                                    }
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
                      onClick={() =>
                        setMidiRollSplitByRootOctave(!midiRollSplitByRootOctave)
                      }
                      title="Top roll if the note's stored octave (badge) is ≥ the top-bar octave; otherwise bottom."
                    >
                      split by root & octave
                    </button>
                  </div>
                </aside>
              )}
            </div>
          )}
          <button
            className={`sounds-toggle ${pickerOpen ? "sounds-toggle-on" : ""}`}
            onClick={() => setPickerOpen((v) => !v)}
          >
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
              <LayerPane />
            </div>
          </div>
        ) : showLayers ? (
          <div className="layers-view">
            <LayerPane />
          </div>
        ) : (
          <div className="layers-view layers-view-midi">
            <MidiRoll />
          </div>
        )}
        <SoundPicker
          selectedLayer={selectedLayerId}
          open={pickerOpen}
          sampleSoundOn={sampleSoundOn}
          onToggleSample={() => setSampleSoundOn((v) => !v)}
        />
      </div>
    </div>
  );
}
