import { LAYER_COLORS, LAYER_META } from "../lib/layers";
import { useLayerStore } from "../store/layerStore";
import { useLayerPlaybackStore } from "../store/layerPlaybackStore";
import type { LayerKnobEffect } from "../types/layer";
import type { LayerCardProps } from "./layers/types";
import { usePointerDrag } from "../hooks/usePointerDrag";

const DRAG_SELECTION_CLASS = "drag-selection-lock";
const KNOB_ARC_START_DEG = -140;
const KNOB_ARC_SWEEP_DEG = 280;
const KNOB_ARC_RADIUS = 18;
const KNOB_ARC_CENTER = 20;

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleDeg: number,
) => {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians),
  };
};

const describeArc = (startDeg: number, endDeg: number) => {
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

export default function LayerCard({
  layerId,
  layer,
  selected,
  solo,
  onSelect,
  onToggleMute,
  onToggleSolo,
}: LayerCardProps) {
  const setLayerVolume = useLayerStore((s) => s.setLayerVolume);
  const setLayerKnobValue = useLayerStore((s) => s.setLayerKnobValue);
  const muted = useLayerPlaybackStore((s) => s.manualMutes[layerId]);

  const meta = LAYER_META[layerId];
  const color = LAYER_COLORS[layerId];
  const sound = layer.defaultMapping.soundId ?? meta.sound;
  const loopCount = Object.keys(layer.layerLoops).length;
  const faderPercent = Math.round(layer.volume * 100);

  const knobDefs = layer.knobOrder
    .map((effect) => {
      const knob = layer.defaultMapping.knobsByEffect[effect];
      if (!knob) return null;

      return {
        effect,
        label: knob.label,
        value: knob.value,
      };
    })
    .filter(Boolean) as Array<{
    effect: LayerKnobEffect;
    label: string;
    value: number;
  }>;

  const handleKnobPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    effect: LayerKnobEffect,
    startValue: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const knobElement = event.currentTarget;
    const startY = event.clientY;
    const pointerId = event.pointerId;

    knobElement.setPointerCapture(pointerId);
    document.body.classList.add(DRAG_SELECTION_CLASS);

    const onMove = (moveEvent: PointerEvent) => {
      if ((moveEvent.buttons & 1) !== 1) {
        onEnd();
        return;
      }

      moveEvent.preventDefault();
      const deltaY = startY - moveEvent.clientY;
      setLayerKnobValue(layerId, effect, startValue + deltaY * 0.012);
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

  const handleFaderPointerDown = usePointerDrag<HTMLDivElement>({
    dragLockClassName: DRAG_SELECTION_CLASS,
    onStart: (element, event) => {
      const rect = element.getBoundingClientRect();
      setLayerVolume(layerId, (event.clientX - rect.left) / rect.width);
    },
    onMove: (element, moveEvent) => {
      const rect = element.getBoundingClientRect();
      setLayerVolume(layerId, (moveEvent.clientX - rect.left) / rect.width);
    },
  });

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
          <span className="pill pill-snd">{sound}</span>
          <span className="pill">{`${loopCount} loop${loopCount === 1 ? "" : "s"}`}</span>
        </div>
      </div>

      <div className="knob-center">
        <div className="knobs">
          {knobDefs.map(({ effect, label, value }) => (
            <div className="kg" key={`${layerId}-knob-${effect}`}>
              {(() => {
                const knobValue = Math.max(0, Math.min(1, value ?? 0.5));
                const knobAngle =
                  KNOB_ARC_START_DEG + knobValue * KNOB_ARC_SWEEP_DEG;
                const fullArcPath = describeArc(
                  KNOB_ARC_START_DEG,
                  KNOB_ARC_START_DEG + KNOB_ARC_SWEEP_DEG,
                );
                const valueArcPath = describeArc(KNOB_ARC_START_DEG, knobAngle);
                const showValueArc = knobValue > 0.001;

                return (
                  <div
                    className="knob"
                    onPointerDown={(event) =>
                      handleKnobPointerDown(event, effect, knobValue)
                    }
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
                          style={{
                            stroke: color,
                            filter: `drop-shadow(0 0 4px ${color})`,
                          }}
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
          <div
            className="fdr"
            onPointerDown={(event) => {
              event.stopPropagation();
              handleFaderPointerDown(event);
            }}
          >
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
          </div>
        </div>
      </div>
    </div>
  );
}
