import { LAYER_COLORS, LAYER_META } from "../lib/specs";
const MAX_EXTRA_KNOBS = 3;
const EXTRA_KNOB_LABELS = ["pan", "atk", "rel"];

/**
 * Spec contract:
 * - One card per layer with selection state.
 * - Show repeat/mode, sound, octave, status pills.
 * - Show volume fader and three knobs (filter, reverb, layer-specific).
 * - Later: pointer drag for fader/knobs + real store/audio binding.
 */
export default function LayerCard({
  layerId,
  layer,
  selected,
  solo,
  onSelect,
  onToggleMute,
  onToggleSolo,
  onAddKnob,
}) {
  const meta = LAYER_META[layerId];
  const color = LAYER_COLORS[layerId];
  const repeatText =
    layer?.mode === "oneshot"
      ? "one-shot"
      : typeof layer?.repeat === "number"
        ? `×${layer.repeat}`
        : typeof meta.repeat === "number"
          ? `×${meta.repeat}`
          : meta.repeat;
  const sound = layer?.sound ?? meta.sound;
  const octave = layer?.octave ?? meta.octave;
  const status =
    layer?.status ?? (layerId === "A" || layerId === "E" ? "playing" : "idle");
  const muted = Boolean(layer?.muted);
  const faderPercent = Math.round((layer?.volume ?? 0.65) * 100);
  const extraKnobs = Math.max(
    0,
    Math.min(MAX_EXTRA_KNOBS, layer?.extraKnobs ?? 0),
  );
  const knobLabels = [
    "fltr",
    "rvb",
    meta.fxLabel,
    ...EXTRA_KNOB_LABELS.slice(0, extraKnobs),
  ];
  const canAddKnob = extraKnobs < MAX_EXTRA_KNOBS;

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
          <span className="pill pill-on">{repeatText}</span>
          <span className="pill pill-snd">{sound}</span>
          {octave !== null && <span className="pill">{`oct ${octave}`}</span>}
          <span
            className={`pill ${status === "playing" ? "pill-play" : "pill-idle"}`}
          >
            {status}
          </span>
        </div>
      </div>
      <div className="knob-center">
        <div className="knobs">
          {knobLabels.map((label) => (
            <div className="kg" key={label}>
              <div className="knob">
                <div className="kd" style={{ background: color }} />
              </div>
              <div className="kl">{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="lc-bot">
        <div className="layer-right-ctrls">
          <div className="fdr">
            <div
              className="fdr-fill"
              style={{ width: `${faderPercent}%`, background: color }}
            />
            <div className="fdr-thumb" style={{ left: `${faderPercent}%` }} />
          </div>
          <div className="layer-btn-row">
            <button
              className={`mute-btn ${muted ? "mute-btn-on" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleMute(layerId);
              }}
              aria-label={`mute layer ${layerId}`}
            >
              M
            </button>
            <button
              className={`mute-btn ${solo ? "solo-btn-on" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSolo(layerId);
              }}
              aria-label={`solo layer ${layerId}`}
            >
              S
            </button>
            <button
              className="mute-btn"
              onClick={(event) => {
                event.stopPropagation();
                onAddKnob(layerId);
              }}
              aria-label={`add knob to layer ${layerId}`}
              disabled={!canAddKnob}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
