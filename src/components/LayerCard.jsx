import { LAYER_COLORS, LAYER_META } from "../lib/specs";

/**
 * Spec contract:
 * - One card per layer with selection state.
 * - Show repeat/mode, sound, octave, status pills.
 * - Show volume fader and three knobs (filter, reverb, layer-specific).
 * - Later: pointer drag for fader/knobs + real store/audio binding.
 */
export default function LayerCard({ layerId, selected, onSelect }) {
  const meta = LAYER_META[layerId];
  const color = LAYER_COLORS[layerId];

  return (
    <div
      className={`lc ${selected ? "lc-sel" : ""}`}
      onClick={() => onSelect(layerId)}
    >
      <div className="lc-top">
        <span className="lc-name" style={{ color }}>
          {`${layerId} — ${meta.role}`}
        </span>
        <div className="pills">
          <span className="pill pill-on">
            {typeof meta.repeat === "number" ? `×${meta.repeat}` : meta.repeat}
          </span>
          <span className="pill pill-snd">{meta.sound}</span>
          {meta.octave !== null && (
            <span className="pill">{`oct ${meta.octave}`}</span>
          )}
          <span
            className={`pill ${layerId === "A" || layerId === "E" ? "pill-play" : "pill-idle"}`}
          >
            {layerId === "A" || layerId === "E" ? "playing" : "idle"}
          </span>
        </div>
      </div>
      <div className="lc-bot">
        <div className="fdr">
          <div
            className="fdr-fill"
            style={{ width: "65%", background: color }}
          />
          <div className="fdr-thumb" style={{ left: "65%" }} />
        </div>
        <div className="knobs">
          <div className="kg">
            <div className="knob">
              <div className="kd" style={{ background: color }} />
            </div>
            <div className="kl">fltr</div>
          </div>
          <div className="kg">
            <div className="knob">
              <div className="kd" style={{ background: color }} />
            </div>
            <div className="kl">rvb</div>
          </div>
          <div className="kg">
            <div className="knob">
              <div className="kd" style={{ background: color }} />
            </div>
            <div className="kl">{meta.fxLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
