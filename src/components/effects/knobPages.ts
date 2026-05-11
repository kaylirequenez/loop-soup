import { loopSoundToMapping } from "../../sound/soundMapping";
import {
  EFFECT_PAGE_KNOBS,
  LOOP_EFFECT_LABELS,
  getSoundCategory,
} from "../../sound/soundSpecs";
import { useLayerStore } from "../../store/layerStore";
import { useLayerEditorStore } from "../../store/layerEditorStore";
import { useSoundStore } from "../../store/soundStore";
import type { LayerId, LayerLoopId } from "../../types/layer";
import type {
  KnobEffect,
  LayerMixEffect,
  LoopEffectType,
  SoundId,
} from "../../types/sound";
import { buildLayerKnobDefs, buildMixKnobDefs } from "./KnobGrid";

export const LAYER_MIX_SECTIONS: { label: string; knobs: LayerMixEffect[] }[] =
  [
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

export const ALL_OPTIONAL_EFFECTS: LoopEffectType[] = [
  "chorus",
  "phaser",
  "vibrato",
  "autoFilter",
  "tremolo",
  "distortion",
  "bitCrusher",
];

export function coreSectionsForSoundId(soundId: SoundId) {
  const soundCategory = getSoundCategory(soundId);
  return soundCategory === "player"
    ? CORE_SECTIONS_PLAYER
    : soundCategory === "sampler"
      ? CORE_SECTIONS_SAMPLER
      : CORE_SECTIONS_OSCILLATOR;
}

export interface KnobPage {
  label: string;
  kind: "sound" | "mix";
  effects: string[];
}

export function getLayerKnobPages(layerId: LayerId): KnobPage[] {
  const mixKnobs = useSoundStore.getState().getLayerMixKnobs(layerId);
  return LAYER_MIX_SECTIONS.map((section) => ({
    label: section.label,
    kind: "mix",
    effects: buildMixKnobDefs(section.knobs, mixKnobs).map(
      (knob) => knob.effect,
    ),
  }));
}

export function getLoopKnobPages(
  layerId: LayerId,
  loopId: LayerLoopId,
): KnobPage[] {
  const loopSound = useSoundStore.getState().getLoopSound(layerId, loopId);
  const activeMapping = loopSoundToMapping(loopSound);
  const corePages = coreSectionsForSoundId(loopSound.soundId).map((section) => ({
    label: section.label,
    kind: "sound" as const,
    effects: buildLayerKnobDefs(section.knobs, activeMapping).map(
      (knob) => knob.effect,
    ),
  }));
  const activeEffectTypes = new Set(
    loopSound.effects.map((effect) => effect.type as LoopEffectType),
  );
  const loop = useLayerStore.getState().layers[layerId]?.layerLoops[loopId];
  const orderedFromLoop =
    loop?.pageOrder
      .map((label) =>
        ALL_OPTIONAL_EFFECTS.find((effect) => LOOP_EFFECT_LABELS[effect] === label),
      )
      .filter((effect): effect is LoopEffectType => effect != null) ?? [];
  const optionalOrder = [
    ...orderedFromLoop,
    ...ALL_OPTIONAL_EFFECTS.filter((effect) => !orderedFromLoop.includes(effect)),
  ];
  const optionalPages = optionalOrder
    .filter((effect) => activeEffectTypes.has(effect))
    .map((effect) => ({
      label: LOOP_EFFECT_LABELS[effect],
      kind: "sound" as const,
      effects: buildLayerKnobDefs(EFFECT_PAGE_KNOBS[effect], activeMapping).map(
        (knob) => knob.effect,
      ),
    }));
  return [...corePages, ...optionalPages].filter(
    (page) => page.effects.length > 0,
  );
}

export function getSelectedKnobPages(): KnobPage[] {
  const { selectedLayerId, selectedLoopId } = useLayerEditorStore.getState();
  return selectedLoopId == null
    ? getLayerKnobPages(selectedLayerId)
    : getLoopKnobPages(selectedLayerId, selectedLoopId);
}
