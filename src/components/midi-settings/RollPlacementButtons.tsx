import type { MidiRollPlacement } from "../../types/midi";

const ROLL_PLACEMENT_OPTIONS: Array<{
  key: string;
  value: MidiRollPlacement;
  label: string;
  title: string;
}> = [
  { key: "1", value: "1", label: "1", title: "Show on roll 1 only" },
  { key: "2", value: "2", label: "2", title: "Show on roll 2 only" },
  { key: "both", value: "both", label: "1+2", title: "Show on both rolls" },
];

type RollPlacementButtonsProps = {
  value: MidiRollPlacement | null;
  ariaLabel: string;
  onChange: (placement: MidiRollPlacement) => void;
  titleForOption?: (placement: MidiRollPlacement, defaultTitle: string) => string;
};

export function RollPlacementButtons({
  value,
  ariaLabel,
  onChange,
  titleForOption,
}: RollPlacementButtonsProps) {
  return (
    <div className="comp-roll-placement" role="group" aria-label={ariaLabel}>
      {ROLL_PLACEMENT_OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          className={`comp-roll-placement-btn ${value === opt.value ? "comp-roll-placement-btn--on" : ""}`}
          title={titleForOption?.(opt.value, opt.title) ?? opt.title}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
