import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMidiStore } from "../../store/midiStore";
import { useCompositionStore } from "../../store/compositionStore";
import { oneBasedRange } from "../../utils";
import { LAYER_IDS } from "../../types/layer";
import { RollPlacementButtons } from "./RollPlacementButtons";

const MAX_MIDI_MEASURES_VISIBLE_OPTION = 4;

export default function MidiMenu() {
  const [open, setOpen] = useState(false);
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
  const totalMeasures = useCompositionStore((s) => s.totalMeasures);
  const showStackedRoll = midiRollCount === 2;
  const rollPlacementMenuEnabled =
    showStackedRoll && !midiRollSplitByRootOctave;

  return (
    <div className="midi-menu-anchor">
      <button
        className={`midi-panel-toggle ${open ? "midi-panel-toggle-on" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        midi menu
      </button>
      {open && (
        <aside className="midi-roll-menu midi-roll-menu-dropdown">
          <div className="midi-menu-section">
            <button
              type="button"
              className="midi-menu-btn"
              onClick={toggleSecondRoll}
            >
              {showStackedRoll ? "remove roll 2" : "add roll 2"}
            </button>
          </div>
          <div className="midi-menu-section">
            <div className="midi-menu-title">measures shown</div>
            <div className="midi-measures-shown-grid">
              {oneBasedRange(MAX_MIDI_MEASURES_VISIBLE_OPTION).map((n) => {
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
              })}
            </div>
          </div>
          <div className="midi-menu-section">
            <div className="midi-menu-title">layers in MIDI rolls</div>
            {rollPlacementMenuEnabled ? (
              <div className="midi-layer-roll-list">
                {LAYER_IDS.map((layerId) => {
                  const pl = midiLayerPlacement[layerId];
                  return (
                    <div className="midi-layer-roll-row" key={layerId}>
                      <span className="midi-layer-roll-id">{layerId}</span>
                      <div className="midi-layer-roll-pick">
                        <RollPlacementButtons
                          value={pl}
                          ariaLabel={`MIDI rolls for layer ${layerId}`}
                          onChange={(placement) =>
                            setMidiLayerRollPlacement(layerId, placement)
                          }
                          titleForOption={(placement) =>
                            placement === "both"
                              ? "Show this layer on both rolls"
                              : `Show this layer on roll ${placement} only`
                          }
                        />
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
  );
}
