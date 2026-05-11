import { useShallow } from "zustand/react/shallow";
import LayerCard from "./LayerCard";
import MidiMeasureNav from "./midi-settings/MidiMeasureNav";
import MidiMenu from "./midi-settings/MidiMenu";
import MidiRoll from "./MidiRoll";
import SoundPicker from "./SoundPicker";
import EffectsPanel from "./EffectsPanel";
import { useLayerStore } from "../store/layerStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useWorkspaceUiStore } from "../store/workspaceUiStore";
import type { LayerId } from "../types/layer";

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
  const {
    currentView,
    pickerOpen,
    effectsOpen,
    setCurrentView,
    togglePickerOpen,
    toggleEffectsOpen,
  } = useWorkspaceUiStore(
    useShallow((s) => ({
      currentView: s.currentView,
      pickerOpen: s.pickerOpen,
      effectsOpen: s.effectsOpen,
      setCurrentView: s.setCurrentView,
      togglePickerOpen: s.togglePickerOpen,
      toggleEffectsOpen: s.toggleEffectsOpen,
    })),
  );
  const { selectedLayerId } = useLayerEditorStore(
    useShallow((s) => ({
      selectedLayerId: s.selectedLayerId,
    })),
  );

  const showLayers = currentView === "layers" || currentView === "dual";
  const showMidi = currentView === "midi" || currentView === "dual";
  const dualView = currentView === "dual";

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
        <div
          className={`view-bar-right-controls ${pickerOpen ? "view-bar-right-controls-sound-open" : ""}`}
        >
          {showMidi && <MidiMenu />}
          <button
            className={`sounds-toggle ${effectsOpen ? "sounds-toggle-on" : ""}`}
            onClick={toggleEffectsOpen}
          >
            {effectsOpen ? "effects ✕" : "effects ▸"}
          </button>
          <button
            className={`sounds-toggle ${pickerOpen ? "sounds-toggle-on" : ""}`}
            onClick={togglePickerOpen}
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
        <EffectsPanel selectedLayer={selectedLayerId} open={effectsOpen} />
        <SoundPicker selectedLayer={selectedLayerId} open={pickerOpen} />
      </div>
    </div>
  );
}
