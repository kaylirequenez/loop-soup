import { useEffect } from "react";
import { subscribeLoopTimeline } from "./utils/subscribeLoopTimeline";
import { handleGlobalKeyDown } from "./components/userInput/globalKeyHandler";
import BottomControls from "./components/BottomControls";
import CompositionView from "./components/CompositionView";
import DevToolbar from "./components/DevToolbar";
import WorkspacePanel from "./components/WorkspacePanel";
import { useTransportClock } from "./hooks/useTransportClock";
import { useAudioScheduler } from "./hooks/useAudioScheduler";
import SoftPot from "./components/SoftPot";
import TopBar from "./components/TopBar";

export default function App() {
  useTransportClock();
  useAudioScheduler();
  useEffect(() => subscribeLoopTimeline(), []);
  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  return (
    <main className="app-wrap">
      {import.meta.env.DEV && <DevToolbar />}
      <section className="screen">
        <TopBar />
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
    </main>
  );
}
