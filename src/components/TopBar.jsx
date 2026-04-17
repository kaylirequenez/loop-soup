/**
 * Spec contract:
 * - Always show BPM, key, meter, loop length.
 * - Center "+ make hook" control.
 * - Right side shows loop index and live/stopped transport state.
 * - Later: BPM/key/meter inline overrides and real store wiring.
 */
export default function TopBar({
  isPlaying,
  onOpenHook,
  currentLoop,
  totalLoops,
}) {
  return (
    <div className="top-bar">
      <div className="stats">
        <div>
          <div className="stat-val">128</div>
          <div className="stat-label">BPM</div>
        </div>
        <div>
          <div className="stat-val">A min</div>
          <div className="stat-label">key</div>
        </div>
        <div>
          <div className="stat-val">4/4</div>
          <div className="stat-label">meter</div>
        </div>
        <div>
          <div className="stat-val">4 bars</div>
          <div className="stat-label">loop</div>
        </div>
      </div>

      <button className="hook-btn" onClick={onOpenHook}>
        + make hook
      </button>

      <div className="top-right">
        <span className="loop-num">{`loop ${currentLoop} of ${totalLoops}`}</span>
        <div className={`live-pill ${isPlaying ? "live-pill-on" : ""}`}>
          <div className="live-dot" />
          <span>{isPlaying ? "live" : "stopped"}</span>
        </div>
      </div>
    </div>
  );
}
