import type {
  KnobEffect,
  LayerMixEffect,
  LayerKnobsByEffect,
  LayerMixKnobs,
  SoundMapping,
} from "../../types/sound";
import { KNOB_SPECS, MIX_KNOB_SPECS } from "../../sound/soundSpecs";
import { clamp01 } from "../../utils";

const KNOB_ARC_START_DEG = -140;
const KNOB_ARC_SWEEP_DEG = 280;
const KNOB_ARC_RADIUS = 18;
const KNOB_ARC_CENTER = 20;
const MIN_KNOB_VALUE_ARC = 0.001;

export interface KnobDisplayDef {
  effect: string;
  label: string;
  fullName: string;
  value: number;
}

export interface LayerKnobDisplayDef extends KnobDisplayDef {
  effect: KnobEffect;
}

export interface LayerMixKnobDef extends KnobDisplayDef {
  effect: LayerMixEffect;
}

interface KnobGridProps {
  color: string;
  defs: KnobDisplayDef[];
  selectedEffect?: string;
  onKnobPointerDown: (
    event: React.PointerEvent<HTMLDivElement>,
    effect: string,
    startValue: number,
  ) => void;
}

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

const getKnobUi = (rawValue: number) => {
  const knobValue = clamp01(rawValue);
  const knobAngle = KNOB_ARC_START_DEG + knobValue * KNOB_ARC_SWEEP_DEG;
  return {
    knobValue,
    fullArcPath: describeArc(
      KNOB_ARC_START_DEG,
      KNOB_ARC_START_DEG + KNOB_ARC_SWEEP_DEG,
    ),
    valueArcPath: describeArc(KNOB_ARC_START_DEG, knobAngle),
    showValueArc: knobValue > MIN_KNOB_VALUE_ARC,
    indicatorRotationDeg: (knobValue - 0.5) * KNOB_ARC_SWEEP_DEG,
  };
};

export const buildMixKnobDefs = (
  order: LayerMixEffect[],
  mixKnobs: LayerMixKnobs,
): LayerMixKnobDef[] =>
  order.map((effect) => ({
    effect,
    label: mixKnobs[effect]?.label ?? MIX_KNOB_SPECS[effect].label,
    fullName: MIX_KNOB_SPECS[effect].name,
    value: mixKnobs[effect]?.value ?? 0.5,
  }));

export const buildLayerKnobDefs = (
  activeKnobOrder: KnobEffect[],
  activeMapping: SoundMapping,
): LayerKnobDisplayDef[] =>
  activeKnobOrder
    .map((effect) => {
      const knob = (activeMapping.knobsByEffect as LayerKnobsByEffect)[effect];
      if (!knob) return null;
      return {
        effect,
        label: knob.label,
        fullName: KNOB_SPECS[effect].name,
        value: knob.value,
      };
    })
    .filter((knob): knob is LayerKnobDisplayDef => knob != null);

export default function KnobGrid({
  color,
  defs,
  selectedEffect,
  onKnobPointerDown,
}: KnobGridProps) {
  return (
    <div className="knobs">
      {defs.map(({ effect, label, fullName, value }) => {
        const {
          knobValue,
          fullArcPath,
          valueArcPath,
          showValueArc,
          indicatorRotationDeg,
        } = getKnobUi(value ?? 0.5);

        return (
          <div className={`kg${selectedEffect === effect ? " kg--selected" : ""}`} key={`knob-${effect}`}>
            <div
              className="knob"
              onPointerDown={(event) =>
                onKnobPointerDown(event, effect, knobValue)
              }
            >
              <svg className="knob-ring" viewBox="0 0 40 40" aria-hidden="true">
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
            <div className="kl" aria-label={fullName}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
