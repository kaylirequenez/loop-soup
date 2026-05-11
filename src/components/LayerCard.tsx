import { Fragment, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { LAYER_COLORS } from "../ui/layerTheme";
import { loopSoundToMapping } from "../sound/soundMapping";
import {
  EFFECT_PAGE_KNOBS,
  LOOP_EFFECT_LABELS,
  getSoundCategory,
} from "../sound/soundSpecs";
import { useLayerStore } from "../store/layerStore";
import { useSoundStore } from "../store/soundStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerPlaybackStore } from "../store/layerPlaybackStore";
import type { LayerId } from "../types/layer";
import type {
  KnobEffect,
  LayerMixEffect,
  LoopEffectType,
} from "../types/sound";
import { usePointerDrag } from "../hooks/usePointerDrag";
import { buildLayerKnobDefs, buildMixKnobDefs } from "./effects/KnobGrid";
import KnobGrid from "./effects/KnobGrid";
import EnvelopeDisplay from "./effects/EnvelopeDisplay";

const DRAG_SELECTION_CLASS = "drag-selection-lock";

const LAYER_MIX_SECTIONS: { label: string; knobs: LayerMixEffect[] }[] = [
  { label: "EQ", knobs: ["eqLow", "eqMid", "eqHigh"] },
  {
    label: "Comp",
    knobs: ["compThreshold", "compRatio", "compAttack", "compRelease"],
  },
];

const CORE_SECTIONS_OSCILLATOR: { label: string; knobs: KnobEffect[] }[] = [
  { label: "Filter", knobs: ["filterCutoff", "filterResonance"] },
  { label: "Send", knobs: ["reverbSend", "delaySend"] },
  { label: "Synth", knobs: ["portamento", "pitchDriftRange"] },
];
const CORE_SECTIONS_SAMPLER: { label: string; knobs: KnobEffect[] }[] = [
  { label: "Filter", knobs: ["filterCutoff", "filterResonance"] },
  { label: "Send", knobs: ["reverbSend", "delaySend"] },
  { label: "Synth", knobs: ["pitchDriftRange"] },
];
const CORE_SECTIONS_PLAYER: { label: string; knobs: KnobEffect[] }[] = [
  { label: "Filter", knobs: ["filterCutoff", "filterResonance"] },
  { label: "Send", knobs: ["reverbSend", "delaySend"] },
];

const ALL_OPTIONAL_EFFECTS: LoopEffectType[] = [
  "chorus",
  "phaser",
  "vibrato",
  "autoFilter",
  "tremolo",
  "distortion",
  "bitCrusher",
];

type KnobDragState =
  | { kind: "sound"; effect: KnobEffect; startValue: number; startY: number }
  | { kind: "mix"; effect: LayerMixEffect; startValue: number; startY: number };

export default function LayerCard({ layerId }: { layerId: LayerId }) {
  const layer = useLayerStore((s) => s.layers[layerId]);
  const {
    setLayerVolume,
    setLayerKnobValue,
    setLoopKnobValue,
    setLoopVolume,
    setLoopPan,
    setLayerMixKnobValue,
    removeLoopEffect,
  } = useSoundStore(
    useShallow((s) => ({
      setLayerVolume: s.setLayerVolume,
      setLayerKnobValue: s.setLayerKnobValue,
      setLoopKnobValue: s.setLoopKnobValue,
      setLoopVolume: s.setLoopVolume,
      setLoopPan: s.setLoopPan,
      setLayerMixKnobValue: s.setLayerMixKnobValue,
      removeLoopEffect: s.removeLoopEffect,
    })),
  );
  const selected = useLayerEditorStore((s) => s.selectedLayerId === layerId);
  const onSelect = useLayerEditorStore((s) => s.setSelectedLayerId);
  const activeLoopId = useLayerEditorStore((s) =>
    s.selectedLayerId === layerId ? s.selectedLoopId : null,
  );
  const selectedKnob = useLayerEditorStore((s) => s.selectedKnob);
  const selectKnob = useLayerEditorStore((s) => s.selectKnob);
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
  const activeLoopSound = useSoundStore((s) =>
    activeLoopId != null
      ? s.getLoopSound(layerId, activeLoopId)
      : s.getLayerDefaultSound(layerId),
  );
  const activeMapping = useMemo(
    () => loopSoundToMapping(activeLoopSound),
    [activeLoopSound],
  );
  const layerVolume = useSoundStore((s) => s.getLayerVolume(layerId));
  const layerMixKnobs = useSoundStore((s) => s.getLayerMixKnobs(layerId));

  const isMixPage = activeLoopId == null;
  const soundCategory = getSoundCategory(activeLoopSound.soundId);
  const coreSections =
    soundCategory === "player"
      ? CORE_SECTIONS_PLAYER
      : soundCategory === "sampler"
        ? CORE_SECTIONS_SAMPLER
        : CORE_SECTIONS_OSCILLATOR;
  const activeEffects = activeLoopSound.effects;
  const activeEffectTypes = new Set(
    activeEffects.map((e) => e.type as LoopEffectType),
  );
  const activeOptionalSections = ALL_OPTIONAL_EFFECTS.filter((et) =>
    activeEffectTypes.has(et),
  );

  const loopCount = layer.layerLoops.length;
  const faderValue =
    activeLoopId != null ? activeLoopSound.mix.volume : layerVolume;
  const faderPercent = Math.round(faderValue * 100);
  const panPercent = Math.round(activeLoopSound.mix.pan * 100);

  const mixSectionDefs = LAYER_MIX_SECTIONS.map((s) => ({
    label: s.label,
    defs: buildMixKnobDefs(s.knobs, layerMixKnobs),
  }));

  // Knob drag
  const knobDragStateRef = useRef<KnobDragState | null>(null);
  const handleKnobDragPointerDown = usePointerDrag<HTMLDivElement>({
    dragLockClassName: DRAG_SELECTION_CLASS,
    onStart: (_el, event) => {
      event.stopPropagation();
    },
    onMove: (_el, e) => {
      const drag = knobDragStateRef.current;
      if (!drag || (e.buttons & 1) !== 1) return;
      const newValue = drag.startValue + (drag.startY - e.clientY) * 0.012;
      if (drag.kind === "mix") {
        setLayerMixKnobValue(layerId, drag.effect, newValue);
      } else if (activeLoopId != null) {
        setLoopKnobValue(layerId, activeLoopId, drag.effect, newValue);
      } else {
        setLayerKnobValue(layerId, drag.effect, newValue);
      }
    },
    onEnd: () => {
      knobDragStateRef.current = null;
    },
  });

  const selectedEffectForLayer =
    selectedKnob?.layerId === layerId && selectedKnob?.loopId === activeLoopId
      ? selectedKnob.effect
      : undefined;

  const makeKnobDown =
    (kind: "mix" | "sound") =>
    (
      event: React.PointerEvent<HTMLDivElement>,
      effect: string,
      knobValue: number,
    ) => {
      selectKnob(layerId, activeLoopId, effect, kind);
      knobDragStateRef.current =
        kind === "mix"
          ? {
              kind: "mix",
              effect: effect as LayerMixEffect,
              startValue: knobValue,
              startY: event.clientY,
            }
          : {
              kind: "sound",
              effect: effect as KnobEffect,
              startValue: knobValue,
              startY: event.clientY,
            };
      handleKnobDragPointerDown(event);
    };

  // Fader
  const handleFaderPointerDown = usePointerDrag<HTMLDivElement>({
    dragLockClassName: DRAG_SELECTION_CLASS,
    onStart: (el, event) => {
      const pct =
        (event.clientX - el.getBoundingClientRect().left) /
        el.getBoundingClientRect().width;
      if (activeLoopId != null) setLoopVolume(layerId, activeLoopId, pct);
      else setLayerVolume(layerId, pct);
    },
    onMove: (el, e) => {
      const pct =
        (e.clientX - el.getBoundingClientRect().left) /
        el.getBoundingClientRect().width;
      if (activeLoopId != null) setLoopVolume(layerId, activeLoopId, pct);
      else setLayerVolume(layerId, pct);
    },
  });

  // Pan
  const handlePanPointerDown = usePointerDrag<HTMLDivElement>({
    dragLockClassName: DRAG_SELECTION_CLASS,
    onStart: (el, event) => {
      if (activeLoopId == null) return;
      setLoopPan(
        layerId,
        activeLoopId,
        (event.clientX - el.getBoundingClientRect().left) /
          el.getBoundingClientRect().width,
      );
    },
    onMove: (el, e) => {
      if (activeLoopId == null) return;
      setLoopPan(
        layerId,
        activeLoopId,
        (e.clientX - el.getBoundingClientRect().left) /
          el.getBoundingClientRect().width,
      );
    },
  });

  // Envelope
  const handleEnvelopeKnobChange = (effect: KnobEffect, value: number) => {
    if (activeLoopId != null)
      setLoopKnobValue(layerId, activeLoopId, effect, value);
    else setLayerKnobValue(layerId, effect, value);
  };

  const handleRemoveEffect = (effectType: LoopEffectType) => {
    if (activeLoopId == null) return;
    removeLoopEffect(layerId, activeLoopId, effectType);
  };

  return (
    <div
      className={`lc ${selected ? "lc-sel" : ""}`}
      onClick={() => onSelect(layerId)}
    >
      {/* Left: label + ADSR (ADSR hidden in mix/layer view) */}
      <div className="lc-left">
        <div className="lc-name" style={{ color }}>
          {activeLoopId != null
            ? `${layerId} · loop ${activeLoopId + 1}`
            : `${layerId} — ${layer.role}`}
        </div>
        {!isMixPage && soundCategory !== "player" && (
          <div className="env-left">
            <EnvelopeDisplay
              mapping={activeMapping}
              color={color}
              onKnobChange={handleEnvelopeKnobChange}
            />
          </div>
        )}
      </div>

      {/* Middle: page strip (same structure for mix and loop views) */}
      <div className="lc-mid">
        <div className="page-strip">
          {isMixPage ? (
            <>
              {mixSectionDefs.map((section, i) => (
                <Fragment key={section.label}>
                  {i > 0 && <div className="page-divider" />}
                  <div className="page-section">
                    <div className="page-section-label">{section.label}</div>
                    <KnobGrid
                      color={color}
                      defs={section.defs}
                      selectedEffect={selectedEffectForLayer}
                      onKnobPointerDown={makeKnobDown("mix")}
                    />
                  </div>
                </Fragment>
              ))}
            </>
          ) : (
            <>
              {coreSections.map((section, i) => (
                <Fragment key={section.label}>
                  {i > 0 && <div className="page-divider" />}
                  <div className="page-section">
                    <div className="page-section-label">{section.label}</div>
                    <KnobGrid
                      color={color}
                      defs={buildLayerKnobDefs(section.knobs, activeMapping)}
                      selectedEffect={selectedEffectForLayer}
                      onKnobPointerDown={makeKnobDown("sound")}
                    />
                  </div>
                </Fragment>
              ))}
              {activeOptionalSections.map((et) => (
                <Fragment key={et}>
                  <div className="page-divider" />
                  <div className="page-section">
                    <div className="page-section-header">
                      <span className="page-section-label">
                        {LOOP_EFFECT_LABELS[et]}
                      </span>
                      <button
                        className="effect-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveEffect(et);
                        }}
                        aria-label={`Remove ${LOOP_EFFECT_LABELS[et]}`}
                      >
                        ×
                      </button>
                    </div>
                    <KnobGrid
                      color={color}
                      defs={buildLayerKnobDefs(
                        EFFECT_PAGE_KNOBS[et],
                        activeMapping,
                      )}
                      selectedEffect={selectedEffectForLayer}
                      onKnobPointerDown={makeKnobDown("sound")}
                    />
                  </div>
                </Fragment>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Right: controls */}
      <div className="lc-right">
        <div className="lc-right-top">
          <div className="pills">
            <span className="pill pill-snd">{activeLoopSound.soundId}</span>
            <span className="pill">
              {loopCount} loop{loopCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="lc-right-mid">
          <div className="fdr-row">
            <span className="fdr-row-label">
              {activeLoopId != null ? "loop vol" : "vol"}
            </span>
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
            </div>
          </div>
          {activeLoopId != null && (
            <div className="fdr-row">
              <span className="fdr-row-label">pan</span>
              <div
                className="pan-ctrl"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  handlePanPointerDown(event);
                }}
              >
                <span className="pan-label pan-label-left">L</span>
                <div className="pan-center" />
                <span className="pan-label pan-label-right">R</span>
                <div
                  className="pan-thumb"
                  style={{ left: `${panPercent}%`, borderColor: color }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="layer-btn-row">
          <button
            className={`mute-btn ${muted ? "mute-btn-on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleManualMute(layerId);
            }}
            aria-label={`mute layer ${layerId}`}
          >
            M
          </button>
          <button
            className={`mute-btn ${solo ? "solo-btn-on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleLayerSolo(layerId);
            }}
            aria-label={`solo layer ${layerId}`}
          >
            S
          </button>
        </div>
      </div>
    </div>
  );
}
