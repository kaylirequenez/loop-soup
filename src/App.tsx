import { useState } from "react";
import BottomControls from "./components/BottomControls";
import CompositionView from "./components/CompositionView";
import DevToolbar from "./components/DevToolbar";
import WorkspacePanel from "./components/WorkspacePanel";
import MakeHookModal from "./components/MakeHookModal";
import { useTransportClock } from "./hooks/useTransportClock";
import SoftPot from "./components/SoftPot";
import TopBar from "./components/TopBar";

export default function App() {
  const [showHookModal, setShowHookModal] = useState(false);
  useTransportClock();

  return (
    <main className="app-wrap">
      {import.meta.env.DEV && <DevToolbar />}
      <section className="screen">
        <TopBar onOpenHook={() => setShowHookModal(true)} />
        <div className="main">
          <div className="main-top">
            <SoftPot />
            <WorkspacePanel />
          </div>
          <div className="composition-row">
            <CompositionView />
          </div>
        </div>
        <BottomControls />
      </section>
      {showHookModal && (
        <MakeHookModal onClose={() => setShowHookModal(false)} />
      )}
    </main>
  );
}
