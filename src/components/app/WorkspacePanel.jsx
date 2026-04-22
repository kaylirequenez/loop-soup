import LayerList from "../LayerList";
import MidiMeasureNav from "../MidiMeasureNav";
import MidiRoll from "../MidiRoll";
import SoundPicker from "../SoundPicker";
import { deriveMidiLayerRollMenuFromLoops } from "../../store/appStore";
import { oneBasedRange } from "../../lib/range";
import { LAYER_ORDER } from "../../lib/specs";

const MIDI_MENU_LAYER_ROLL_OPTS = [
  { key: "1", value: "1", label: "1", title: "Show this layer on roll 1 only" },
  { key: "2", value: "2", label: "2", title: "Show this layer on roll 2 only" },
  {
    key: "both",
    value: "both",
    label: "1+2",
    title: "Show this layer on both rolls",
  },
];
const MAX_MIDI_MEASURES_VISIBLE_OPTION = 4;

function LayerPane({
  selectedLayer,
  onSelectLayer,
  onToggleLayerMute,
  onToggleLayerSolo,
  onAddLayerKnob,
  soloLayerId,
  layers,
}) {
  return (
    <LayerList
      selectedLayer={selectedLayer}
      onSelectLayer={onSelectLayer}
      onToggleLayerMute={onToggleLayerMute}
      onToggleLayerSolo={onToggleLayerSolo}
      onAddLayerKnob={onAddLayerKnob}
      soloLayerId={soloLayerId}
      layers={layers}
    />
  );
}

export default function WorkspacePanel(props) {
  const {
    currentView,
    onSetView,
    showMidi,
    midiMenuOpen,
    onToggleMidiMenuOpen,
    midiRollSplitByRootOctave,
    showStackedRoll,
    onSetMidiRollCount,
    onSetMidiRollSplitByRootOctave,
    layerMeasureCount,
    midiMeasuresVisible,
    onSetMidiMeasuresVisible,
    rollPlacementMenuEnabled,
    layers,
    midiLoopRollPlacement,
    onSetMidiLayerRollPlacement,
    pickerOpen,
    onTogglePickerOpen,
    sampleSoundOn,
    onSetSampleSoundOn,
    dualView,
    showLayers,
    selectedLayer,
    onSelectLayer,
    onToggleLayerMute,
    onToggleLayerSolo,
    onAddLayerKnob,
    soloLayerId,
  } = props;

  return (
    <div className="right">
      <div className="view-bar">
        <button
          className={`vb ${currentView === "layers" ? "vb-on" : ""}`}
          onClick={() => onSetView("layers")}
        >
          layers
        </button>
        <button
          className={`vb ${currentView === "midi" ? "vb-on" : ""}`}
          onClick={() => onSetView("midi")}
        >
          midi roll
        </button>
        <button
          className={`vb ${currentView === "dual" ? "vb-on" : ""}`}
          onClick={() => onSetView("dual")}
        >
          dual
        </button>
        {showMidi && <MidiMeasureNav currentView={currentView} />}
        <div className="view-bar-right-controls">
          {showMidi && (
            <div className="midi-menu-anchor">
              <button
                className={`midi-panel-toggle ${midiMenuOpen ? "midi-panel-toggle-on" : ""}`}
                onClick={onToggleMidiMenuOpen}
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
                          onSetMidiRollCount(1);
                          return;
                        }
                        onSetMidiRollSplitByRootOctave(false);
                        onSetMidiRollCount(2);
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
                          n ===
                          Math.min(
                            midiMeasuresVisible,
                            layerMeasureCount,
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
                                ? `Composition has only ${layerMeasureCount} measure${layerMeasureCount === 1 ? "" : "s"}`
                                : undefined
                            }
                            onClick={() => onSetMidiMeasuresVisible(n)}
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
                          const pl = deriveMidiLayerRollMenuFromLoops(
                            layers,
                            midiLoopRollPlacement,
                            layerId,
                          );
                          return (
                            <div className="midi-layer-roll-row" key={layerId}>
                              <span className="midi-layer-roll-id">{layerId}</span>
                              <div
                                className="midi-layer-roll-pick"
                                role="group"
                                aria-label={`MIDI rolls for layer ${layerId}`}
                              >
                                {MIDI_MENU_LAYER_ROLL_OPTS.map((opt) => (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    className={`comp-roll-placement-btn ${
                                      pl != null && pl === opt.value
                                        ? "comp-roll-placement-btn--on"
                                        : ""
                                    }`}
                                    title={opt.title}
                                    aria-pressed={pl != null && pl === opt.value}
                                    onClick={() =>
                                      onSetMidiLayerRollPlacement(layerId, opt.value)
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
                      onClick={() => {
                        if (midiRollSplitByRootOctave) {
                          onSetMidiRollSplitByRootOctave(false);
                          return;
                        }
                        onSetMidiRollSplitByRootOctave(true);
                        onSetMidiRollCount(2);
                      }}
                      title="Top roll if the note’s stored octave (badge) is ≥ the top-bar octave; otherwise bottom. Same 0–7 scale."
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
            onClick={onTogglePickerOpen}
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
              <LayerPane
                selectedLayer={selectedLayer}
                onSelectLayer={onSelectLayer}
                onToggleLayerMute={onToggleLayerMute}
                onToggleLayerSolo={onToggleLayerSolo}
                onAddLayerKnob={onAddLayerKnob}
                soloLayerId={soloLayerId}
                layers={layers}
              />
            </div>
          </div>
        ) : showLayers ? (
          <div className="layers-view">
            <LayerPane
              selectedLayer={selectedLayer}
              onSelectLayer={onSelectLayer}
              onToggleLayerMute={onToggleLayerMute}
              onToggleLayerSolo={onToggleLayerSolo}
              onAddLayerKnob={onAddLayerKnob}
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
          onToggleSample={() => onSetSampleSoundOn(!sampleSoundOn)}
        />
      </div>
    </div>
  );
}
