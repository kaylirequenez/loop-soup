import { LOOP_EFFECT_LABELS } from "../../sound/soundSpecs";
import type { LoopEffectType } from "../../types/sound";

const PICKER_GROUPS: { label: string; effects: LoopEffectType[] }[] = [
  {
    label: "Modulation",
    effects: ["chorus", "phaser", "vibrato", "autoFilter", "tremolo"],
  },
  {
    label: "Color",
    effects: ["distortion", "bitCrusher"],
  },
];

interface Props {
  activeEffectTypes: Set<LoopEffectType>;
  onAdd: (effectType: LoopEffectType) => void;
  onClose: () => void;
  top: number;
  left: number;
}

export default function EffectPicker({ activeEffectTypes, onAdd, onClose, top, left }: Props) {
  return (
    <>
      <div className="picker-backdrop" onClick={onClose} />
      <div
        className="effect-picker"
        style={{ top, left }}
        onClick={(e) => e.stopPropagation()}
      >
        {PICKER_GROUPS.map((group) => (
          <div key={group.label} className="picker-group">
            <div className="picker-group-label">{group.label}</div>
            {group.effects.map((et) => {
              const active = activeEffectTypes.has(et);
              return (
                <button
                  key={et}
                  className={`picker-effect-btn${active ? " picker-effect-active" : ""}`}
                  onClick={() => { if (!active) onAdd(et); }}
                  disabled={active}
                >
                  {LOOP_EFFECT_LABELS[et]}
                  {active && <span className="picker-check">✓</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
