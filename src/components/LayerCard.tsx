import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { LAYER_COLORS } from "../ui/layerTheme";
import { defaultSoundForLayer } from "../lib/sounds";
import { useLayerStore } from "../store/layerStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerPlaybackStore } from "../store/layerPlaybackStore";
import type { LayerId, LayerKnobEffect } from "../types/layer";
import { usePointerDrag } from "../hooks/usePointerDrag";
import {
  buildLayerKnobDefs,
  getKnobUi,
  getLayerLoopCountLabel,
} from "../ui/layerCardUi";

const DRAG_SELECTION_CLASS = "drag-selection-lock";

export default function LayerCard({ layerId }: { layerId: LayerId }) {
  const layer = useLayerStore((s) => s.layers[layerId]);
  const { setLayerVolume, setLayerKnobValue, setLoopKnobValue } = useLayerStore(
    useShallow((s) => ({
      setLayerVolume: s.setLayerVolume,
      setLayerKnobValue: s.setLayerKnobValue,
      setLoopKnobValue: s.setLoopKnobValue,
    })),
  );
  const selected = useLayerEditorStore((s) => s.selectedLayerId === layerId);
  const onSelect = useLayerEditorStore((s) => s.setSelectedLayerId);
  const activeLoopId = useLayerEditorStore((s) =>
    s.selectedLayerId === layerId ? s.selectedLoopId : null,
  );
  const { toggleManualMute, toggleLayerSolo, soloLayerId } =
    useLayerPlaybackStore(
      useShallow((s) => ({
        toggleManualMute: s.toggleManualMute,
        toggleLayerSolo: s.toggleLayerSolo,
        soloLayerId: s.soloLayerId,
      })),
    );
  const solo = soloLayerId === layerId;
  const muted = useLayerPlaybackStore((s) => !s.isLayerAudible(layerId));

  const color = LAYER_COLORS[layerId];
  const activeLoop = activeLoopId != null ? layer.layerLoops[activeLoopId] : null;
  const activeMapping = activeLoop ? activeLoop.mapping : layer.defaultMapping;
  const activeKnobOrder = activeLoop ? activeLoop.knobOrder : layer.knobOrder;
  const sound = activeMapping.soundId ?? defaultSoundForLayer(layerId);
  const loopCount = Object.keys(layer.layerLoops).length;
  const faderPercent = Math.round(layer.volume * 100);

  const knobDefs = buildLayerKnobDefs(activeKnobOrder, activeMapping);

  const knobDragStateRef = useRef<{
    effect: LayerKnobEffect;
    startValue: number;
    startY: number;
  } | null>(null);

  const handleKnobDragPointerDown = usePointerDrag<HTMLDivElement>({
    dragLockClassName: DRAG_SELECTION_CLASS,
    onStart: (_element, event) => {
      event.stopPropagation();
    },
    onMove: (_element, moveEvent) => {
      const dragState = knobDragStateRef.current;
      if (!dragState) return;
      if ((moveEvent.buttons & 1) !== 1) return;
      const deltaY = dragState.startY - moveEvent.clientY;
      const newValue = dragState.startValue + deltaY * 0.012;
      if (activeLoopId != null) {
        setLoopKnobValue(layerId, activeLoopId, dragState.effect, newValue);
      } else {
        setLayerKnobValue(layerId, dragState.effect, newValue);
      }
    },
    onEnd: () => {
      knobDragStateRef.current = null;
    },
  });

  const handleKnobPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    effect: LayerKnobEffect,
    startValue: number,
  ) => {
    knobDragStateRef.current = { effect, startValue, startY: event.clientY };
    handleKnobDragPointerDown(event);
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
          {`${layerId} — ${layer.role}`}
        </span>
        <div className="pills">
          <span className="pill pill-snd">{sound}</span>
          <span className="pill">{getLayerLoopCountLabel(loopCount)}</span>
        </div>
      </div>

      <div className="knob-center">
        <div className="knobs">
          {knobDefs.map(({ effect, label, value }) => (
            <div className="kg" key={`${layerId}-knob-${effect}`}>
              {(() => {
                const {
                  knobValue,
                  fullArcPath,
                  valueArcPath,
                  showValueArc,
                  indicatorRotationDeg,
                } = getKnobUi(value ?? 0.5);

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
                        transform: `translate(-50%, -100%) rotate(${indicatorRotationDeg}deg)`,
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
                toggleManualMute(layerId);
              }}
              aria-label={`mute layer ${layerId}`}
            >
              M
            </button>
            <button
              className={`mute-btn ${solo ? "solo-btn-on" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                toggleLayerSolo(layerId);
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
