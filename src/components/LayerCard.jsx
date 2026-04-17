import { LAYER_COLORS, LAYER_META } from "../lib/specs";
import { useAppStore } from "../store/appStore";
const MAX_EXTRA_KNOBS = 3;
const EXTRA_KNOB_LABELS = ["pan", "atk", "rel"];
const DRAG_SELECTION_CLASS = "drag-selection-lock";
const KNOB_ARC_START_DEG = -140;
const KNOB_ARC_SWEEP_DEG = 280;
const KNOB_ARC_RADIUS = 18;
const KNOB_ARC_CENTER = 20;

const polarToCartesian = (centerX, centerY, radius, angleDeg) => {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
};

const describeArc = (startDeg, endDeg) => {
  const startPoint = polarToCartesian(
    KNOB_ARC_CENTER,
    KNOB_ARC_CENTER,
    KNOB_ARC_RADIUS,
    startDeg,
  );
  const endPoint = polarToCartesian(
    KNOB_ARC_CENTER,
    KNOB_ARC_CENTER,
    KNOB_ARC_RADIUS,
    endDeg,
  );
  const sweep = Math.max(0, endDeg - startDeg);
  const largeArcFlag = sweep > 180 ? 1 : 0;
  return `M ${startPoint.x} ${startPoint.y} A ${KNOB_ARC_RADIUS} ${KNOB_ARC_RADIUS} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`;
};

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
  const setLayerVolume = useAppStore((s) => s.setLayerVolume);
  const setLayerKnobValue = useAppStore((s) => s.setLayerKnobValue);
  const setLayerExtraKnobValue = useAppStore((s) => s.setLayerExtraKnobValue);
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
  const extraKnobValues = layer?.extraKnobValues ?? [0.5, 0.5, 0.5];
  const knobValues = [
    layer?.filter ?? 0.8,
    layer?.reverb ?? 0.2,
    layer?.layerFx ?? 0.0,
    ...extraKnobValues.slice(0, extraKnobs),
  ];
  const canAddKnob = extraKnobs < MAX_EXTRA_KNOBS;

  const updateKnobValue = (index, value) => {
    if (index === 0) {
      setLayerKnobValue(layerId, "filter", value);
      return;
    }
    if (index === 1) {
      setLayerKnobValue(layerId, "reverb", value);
      return;
    }
    if (index === 2) {
      setLayerKnobValue(layerId, "layerFx", value);
      return;
    }
    setLayerExtraKnobValue(layerId, index - 3, value);
  };

  const handleKnobPointerDown = (event, index) => {
    event.preventDefault();
    event.stopPropagation();
    const knobElement = event.currentTarget;
    const startY = event.clientY;
    const startValue = knobValues[index] ?? 0.5;
    const pointerId = event.pointerId;
    knobElement.setPointerCapture(pointerId);
    document.body.classList.add(DRAG_SELECTION_CLASS);

    const onMove = (moveEvent) => {
      if ((moveEvent.buttons & 1) !== 1) {
        onEnd();
        return;
      }
      moveEvent.preventDefault();
      const deltaY = startY - moveEvent.clientY;
      updateKnobValue(index, startValue + deltaY * 0.012);
    };

    const onEnd = () => {
      knobElement.removeEventListener("pointermove", onMove);
      knobElement.removeEventListener("pointerup", onEnd);
      knobElement.removeEventListener("pointercancel", onEnd);
      if (knobElement.hasPointerCapture(pointerId)) {
        knobElement.releasePointerCapture(pointerId);
      }
      document.body.classList.remove(DRAG_SELECTION_CLASS);
    };

    knobElement.addEventListener("pointermove", onMove);
    knobElement.addEventListener("pointerup", onEnd);
    knobElement.addEventListener("pointercancel", onEnd);
  };

  const handleFaderPointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    const pointerId = event.pointerId;
    element.setPointerCapture(pointerId);
    document.body.classList.add(DRAG_SELECTION_CLASS);

    const updateVolumeFromClientX = (clientX) => {
      const rect = element.getBoundingClientRect();
      const percent = (clientX - rect.left) / rect.width;
      setLayerVolume(layerId, percent);
    };

    updateVolumeFromClientX(event.clientX);

    const onMove = (moveEvent) => {
      moveEvent.preventDefault();
      updateVolumeFromClientX(moveEvent.clientX);
    };

    const onEnd = () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onEnd);
      element.removeEventListener("pointercancel", onEnd);
      document.body.classList.remove(DRAG_SELECTION_CLASS);
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onEnd);
    element.addEventListener("pointercancel", onEnd);
  };

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
          {knobLabels.map((label, index) => (
            <div className="kg" key={label}>
              {(() => {
                const knobValue = Math.max(0, Math.min(1, knobValues[index] ?? 0.5));
                const knobAngle = KNOB_ARC_START_DEG + knobValue * KNOB_ARC_SWEEP_DEG;
                const fullArcPath = describeArc(
                  KNOB_ARC_START_DEG,
                  KNOB_ARC_START_DEG + KNOB_ARC_SWEEP_DEG,
                );
                const valueArcPath = describeArc(KNOB_ARC_START_DEG, knobAngle);
                const showValueArc = knobValue > 0.001;
                return (
              <div
                className="knob"
                onPointerDown={(event) => handleKnobPointerDown(event, index)}
              >
                <svg
                  className="knob-ring"
                  viewBox="0 0 40 40"
                  aria-hidden="true"
                >
                  <path
                    className="knob-ring-track"
                    d={fullArcPath}
                    style={{ stroke: color }}
                  />
                  {showValueArc && (
                    <path
                      className="knob-ring-value"
                      d={valueArcPath}
                      style={{ stroke: color, filter: `drop-shadow(0 0 4px ${color})` }}
                    />
                  )}
                </svg>
                <div
                  className="knob-indicator"
                  style={{
                    background: color,
                    transform: `translate(-50%, -100%) rotate(${(knobValue - 0.5) * 280}deg)`,
                  }}
                />
              </div>
                );
              })()}
              <div className="kl">{label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="lc-bot">
        <div className="layer-right-ctrls">
          <div className="fdr" onPointerDown={handleFaderPointerDown}>
            <div
              className="fdr-fill"
              style={{ width: `${faderPercent}%`, background: color }}
            />
            <div className="fdr-thumb" style={{ left: `${faderPercent}%` }} />
            <span className="fdr-limit fdr-limit-min">0</span>
            <span className="fdr-limit fdr-limit-max">max</span>
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
