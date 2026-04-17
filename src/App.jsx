import { useState } from "react";
import BottomControls from "./components/BottomControls";
import CompositionView from "./components/CompositionView";
import LayerList from "./components/LayerList";
import MakeHookModal from "./components/MakeHookModal";
import MidiRoll from "./components/MidiRoll";
import SoftPot from "./components/SoftPot";
import SoundPicker from "./components/SoundPicker";
import TopBar from "./components/TopBar";

export default function App() {
  const [selectedLayer, setSelectedLayer] = useState("A");
  const [currentView, setCurrentView] = useState("layers");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showHookModal, setShowHookModal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [addOn, setAddOn] = useState(true);
  const [extendOn, setExtendOn] = useState(false);
  const [repeat, setRepeat] = useState(1);
  const [octave, setOctave] = useState(4);

  return (
    <main className="app-wrap">
      <section className="screen">
        <TopBar
          isPlaying={isPlaying}
          onOpenHook={() => setShowHookModal(true)}
          currentLoop={2}
          totalLoops={4}
        />

        <div className="main">
          <SoftPot selectedLayer={selectedLayer} octave={octave} />

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
                className={`sounds-toggle ${pickerOpen ? "sounds-toggle-on" : ""}`}
                onClick={() => setPickerOpen((v) => !v)}
              >
                {pickerOpen ? "sounds ✕" : "sounds ▸"}
              </button>
            </div>

            <div className="mid-area">
              {currentView === "layers" ? (
                <div className="layers-view">
                  <LayerList
                    selectedLayer={selectedLayer}
                    onSelectLayer={setSelectedLayer}
                  />
                  <CompositionView currentLoop={2} totalLoops={4} />
                </div>
              ) : (
                <MidiRoll />
              )}

              <SoundPicker selectedLayer={selectedLayer} open={pickerOpen} />
            </div>
          </div>
        </div>

        <BottomControls
          isPlaying={isPlaying}
          addOn={addOn}
          extendOn={extendOn}
          repeat={repeat}
          octave={octave}
          onTogglePlay={() => setIsPlaying((v) => !v)}
          onToggleAdd={() => setAddOn((v) => !v)}
          onToggleExtend={() => setExtendOn((v) => !v)}
          onSetRepeat={setRepeat}
          onSetOctave={setOctave}
        />
      </section>

      {showHookModal && (
        <MakeHookModal onClose={() => setShowHookModal(false)} />
      )}
    </main>
  );
}
