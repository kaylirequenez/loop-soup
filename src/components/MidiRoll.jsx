import { useState } from "react";
import { useAppStore } from "../store/appStore";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const LAYERS = ["A", "B", "C", "D", "E"];
const ONE_OCTAVE_ROWS = Array.from({ length: 12 }).map((_, i) => {
  const semitone = 11 - i;
  const note = NOTES[(9 + semitone) % 12];
  return { note, label: note === "C" ? `${note}4` : note };
});

const COMBINED_NOTES = [
  { layer: "A", left: 0, width: 22, row: 3 },
  { layer: "A", left: 23, width: 20, row: 5 },
  { layer: "B", left: 0, width: 18, row: 8 },
  { layer: "B", left: 20, width: 16, row: 10 },
  { layer: "C", left: 36, width: 8, row: 4 },
  { layer: "C", left: 45, width: 10, row: 2 },
  { layer: "C", left: 56, width: 9, row: 1 },
  { layer: "D", left: 25, width: 25, row: 6 },
  { layer: "D", left: 52, width: 22, row: 4 },
];

const makeDefaultLayerVisibility = () =>
  Object.fromEntries(LAYERS.map((layerId) => [layerId, true]));

export default function MidiRoll() {
  const midiRollCount = useAppStore((s) => s.midiRollCount);
  const midiMenuOpen = useAppStore((s) => s.midiMenuOpen);
  const setMidiRollCount = useAppStore((s) => s.setMidiRollCount);
  const showStackedRoll = midiRollCount === 2;
  const [roll1Layers, setRoll1Layers] = useState(makeDefaultLayerVisibility);
  const [roll2Layers, setRoll2Layers] = useState(makeDefaultLayerVisibility);

  const toggleLayer = (setRollLayers, layerId) => {
    setRollLayers((current) => ({ ...current, [layerId]: !current[layerId] }));
  };

  const renderLayerMenu = (title, visibility, setVisibility) => (
    <div className="midi-menu-section">
      <div className="midi-menu-title">{title}</div>
      <div className="midi-layer-grid">
        {LAYERS.map((layerId) => (
          <label className="midi-layer-option" key={`${title}-${layerId}`}>
            <input
              type="checkbox"
              checked={Boolean(visibility[layerId])}
              onChange={() => toggleLayer(setVisibility, layerId)}
            />
            <span>{layerId}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderCombinedRoll = (key, visibleLayers) => (
    <div className="combined-roll-panel" key={key}>
      <div className="combined-roll-wrap">
        <div className="combined-roll">
          {ONE_OCTAVE_ROWS.map((row, i) => (
            <div
              key={`${key}-${row.label}-${i}`}
              className={`roll-row ${row.note === "C" ? "roll-row-octave" : ""}`}
              style={{ top: `${(i / 12) * 100}%`, height: `${100 / 12}%` }}
            >
              <div className="row-note-label">{row.label}</div>
            </div>
          ))}

          {COMBINED_NOTES.filter((note) => visibleLayers[note.layer]).map(
            (note, index) => (
            <div
              key={`${key}-${note.layer}-${index}`}
              className={`mnote mnote-${note.layer.toLowerCase()}`}
              style={{
                left: `${note.left}%`,
                width: `${note.width}%`,
                top: `${(note.row / 12) * 100}%`,
                height: `${100 / 12 - 0.25}%`,
              }}
            />
            ),
          )}
          <div className="mroll-ph" style={{ left: "28%" }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="midi-view midi-view-on">
      <div className="midi-content">
        <div className="midi-roll-area">
          <div className={`combined-roll-stack ${showStackedRoll ? "stacked-on" : ""}`}>
            {renderCombinedRoll("roll-a", roll1Layers)}
            {showStackedRoll && renderCombinedRoll("roll-b", roll2Layers)}
          </div>
        </div>
        {midiMenuOpen && (
          <div className="midi-menu-shell">
            <aside className="midi-roll-menu">
              <div className="midi-menu-section">
                <button
                  className="midi-menu-btn"
                  onClick={() => {
                    if (showStackedRoll) {
                      setMidiRollCount(1);
                      return;
                    }
                    setRoll2Layers(makeDefaultLayerVisibility());
                    setMidiRollCount(2);
                  }}
                >
                  {showStackedRoll ? "remove roll 2" : "add roll 2"}
                </button>
              </div>
              {renderLayerMenu("roll 1 layers", roll1Layers, setRoll1Layers)}
              {showStackedRoll &&
                renderLayerMenu("roll 2 layers", roll2Layers, setRoll2Layers)}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
