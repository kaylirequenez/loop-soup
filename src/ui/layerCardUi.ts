import type {
  LayerKnobEffect,
  LayerKnobsByEffect,
  SoundMapping,
} from "../types/layer";

const KNOB_ARC_START_DEG = -140;
const KNOB_ARC_SWEEP_DEG = 280;
const KNOB_ARC_RADIUS = 18;
const KNOB_ARC_CENTER = 20;
const MIN_KNOB_VALUE_ARC = 0.001;

export interface LayerKnobDisplayDef {
  effect: LayerKnobEffect;
  label: string;
  value: number;
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

export const buildLayerKnobDefs = (
  activeKnobOrder: LayerKnobEffect[],
  activeMapping: SoundMapping,
): LayerKnobDisplayDef[] =>
  activeKnobOrder
    .map((effect) => {
      const knob = (activeMapping.knobsByEffect as LayerKnobsByEffect)[effect];
      if (!knob) return null;
      return { effect, label: knob.label, value: knob.value };
    })
    .filter((knob): knob is LayerKnobDisplayDef => knob != null);

export const getLayerLoopCountLabel = (loopCount: number) =>
  `${loopCount} loop${loopCount === 1 ? "" : "s"}`;

export const getKnobUi = (rawValue: number) => {
  const knobValue = Math.max(0, Math.min(1, rawValue));
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
