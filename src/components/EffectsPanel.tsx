import { useShallow } from "zustand/react/shallow";
import { LOOP_EFFECT_LABELS } from "../sound/soundSpecs";
import { useSoundStore } from "../store/soundStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerStore } from "../store/layerStore";
import type { LayerId } from "../types/layer";
import type { LoopEffect, LoopEffectType } from "../types/sound";

/** Stable snapshot for Zustand — inline `[]` breaks useSyncExternalStore (new ref each read). */
const EMPTY_LOOP_EFFECTS: readonly LoopEffect[] = [];

const EFFECT_GROUPS: { label: string; effects: LoopEffectType[] }[] = [
  { label: "Modulation", effects: ["chorus", "phaser", "vibrato", "autoFilter", "tremolo"] },
  { label: "Color", effects: ["distortion", "bitCrusher"] },
];

interface Props {
  selectedLayer: LayerId;
  open: boolean;
}

export default function EffectsPanel({ selectedLayer, open }: Props) {
  const activeLoopId = useLayerEditorStore((s) =>
    s.selectedLayerId === selectedLayer ? s.selectedLoopId : null,
  );

  const { addLoopEffect, removeLoopEffect } = useSoundStore(
    useShallow((s) => ({
      addLoopEffect: s.addLoopEffect,
      removeLoopEffect: s.removeLoopEffect,
    })),
  );

  const setLoopPageOrder = useLayerStore((s) => s.setLoopPageOrder);

  const activeEffects = useSoundStore((s) =>
    activeLoopId != null
      ? s.getLoopSound(selectedLayer, activeLoopId).effects
      : EMPTY_LOOP_EFFECTS,
  );
  const activeEffectTypes = new Set(activeEffects.map((e) => e.type as LoopEffectType));

  const scope = activeLoopId != null ? `loop ${activeLoopId + 1}` : "layer default";

  const handleAdd = (et: LoopEffectType) => {
    if (activeLoopId == null) return;
    addLoopEffect(selectedLayer, activeLoopId, et);
  };

  const handleRemove = (et: LoopEffectType) => {
    if (activeLoopId == null) return;
    removeLoopEffect(selectedLayer, activeLoopId, et);
  };

  return (
    <aside className={`sound-picker ${open ? "picker-open" : ""}`}>
      <div className="picker-hdr">
        <span className="picker-hdr-label">effects</span>
        <span className="picker-layer">{`${selectedLayer} · ${scope}`}</span>
      </div>

      {activeLoopId == null ? (
        <div className="effects-no-loop">Select a loop to add effects</div>
      ) : (
        <div className="snd-list">
          {EFFECT_GROUPS.map((group) => (
            <div key={group.label} className="effects-group">
              <div className="effects-group-title">{group.label}</div>
              {group.effects.map((et) => {
                const active = activeEffectTypes.has(et);
                return (
                  <div key={et} className={`snd-item ${active ? "snd-active" : ""}`}>
                    <span>{LOOP_EFFECT_LABELS[et]}</span>
                    <button
                      className={`effect-toggle-btn ${active ? "effect-toggle-remove" : "effect-toggle-add"}`}
                      onClick={() => active ? handleRemove(et) : handleAdd(et)}
                    >
                      {active ? "×" : "+"}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
