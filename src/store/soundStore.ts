import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { LayerId, LayerLoopId } from "../types/layer";
import type {
  KnobEffect,
  LayerMixEffect,
  LoopEffect,
  LoopEffectType,
  LoopSoundKey,
  LoopSoundState,
  SoundStoreState,
  SoundId,
} from "../types/sound";
import {
  DEFAULT_LAYER_MIX_KNOBS,
  DEFAULT_LAYER_SOUND_DEFAULTS,
  DEFAULT_LAYER_VOLUMES,
  DEFAULT_LOOP_SOUNDS,
} from "./utils/defaults";
import { DEFAULT_EFFECT_VALUES } from "../sound/soundSpecs";
import { clamp01 } from "../utils";
import { audioEngine } from "../audio/audioEngine";
import { partEngine } from "../audio/partEngine";
import { loopSoundToMapping } from "../sound/soundMapping";

export const SOUND_STORE_KEY = "loop-soup-sound";

export const loopSoundKey = (
  layerId: LayerId,
  loopId: LayerLoopId,
): LoopSoundKey => `${layerId}:${loopId}`;

const cloneLoopSound = (loopSound: LoopSoundState): LoopSoundState => ({
  ...loopSound,
  mix: { ...loopSound.mix },
  envelope: { ...loopSound.envelope },
  filter: { ...loopSound.filter },
  sends: { ...loopSound.sends },
  effects: loopSound.effects.map((effect) => ({ ...effect }) as LoopEffect),
});

const updateEffect = <T extends LoopEffect["type"]>(
  loopSound: LoopSoundState,
  type: T,
  patch: Partial<Omit<Extract<LoopEffect, { type: T }>, "type">>,
): LoopSoundState => ({
  ...loopSound,
  effects: loopSound.effects.map((e) =>
    e.type === type ? { ...e, ...patch } : e,
  ) as LoopEffect[],
});

const withUpdatedKnob = (
  loopSound: LoopSoundState,
  effect: KnobEffect,
  value: number,
): LoopSoundState => {
  const next = clamp01(value);
  switch (effect) {
    case "attack":
    case "decay":
    case "sustain":
    case "release":
      return { ...loopSound, envelope: { ...loopSound.envelope, [effect]: next } };
    case "filterCutoff":
      return { ...loopSound, filter: { ...loopSound.filter, cutoff: next } };
    case "filterResonance":
      return { ...loopSound, filter: { ...loopSound.filter, resonance: next } };
    case "reverbSend":
      return { ...loopSound, sends: { ...loopSound.sends, reverb: next } };
    case "delaySend":
      return { ...loopSound, sends: { ...loopSound.sends, delay: next } };
    case "portamento":
      return { ...loopSound, portamento: next };
    case "pitchDriftRange":
      return { ...loopSound, pitchDrift: next };
    case "drive":
      return updateEffect(loopSound, "distortion", { drive: next });
    case "driveWet":
      return updateEffect(loopSound, "distortion", { mix: next });
    case "chorusDepth":
      return updateEffect(loopSound, "chorus", { depth: next });
    case "chorusRate":
      return updateEffect(loopSound, "chorus", { rate: next });
    case "phaserDepth":
      return updateEffect(loopSound, "phaser", { depth: next });
    case "phaserRate":
      return updateEffect(loopSound, "phaser", { rate: next });
    case "vibratoDepth":
      return updateEffect(loopSound, "vibrato", { depth: next });
    case "vibratoRate":
      return updateEffect(loopSound, "vibrato", { rate: next });
    case "autoFilterDepth":
      return updateEffect(loopSound, "autoFilter", { depth: next });
    case "autoFilterRate":
      return updateEffect(loopSound, "autoFilter", { rate: next });
    case "tremoloDepth":
      return updateEffect(loopSound, "tremolo", { depth: next });
    case "tremoloRate":
      return updateEffect(loopSound, "tremolo", { rate: next });
    case "bitCrusherBits":
      return updateEffect(loopSound, "bitCrusher", { amount: next });
    default:
      return loopSound;
  }
};

export const useSoundStore = create<SoundStoreState>()(
  persist(
    (set, get) => ({
      layerVolumes: DEFAULT_LAYER_VOLUMES,
      layerMixKnobs: DEFAULT_LAYER_MIX_KNOBS,
      layerDefaults: DEFAULT_LAYER_SOUND_DEFAULTS,
      loopSounds: DEFAULT_LOOP_SOUNDS,

      getLayerVolume: (layerId) => get().layerVolumes[layerId] ?? 0.7,
      getLayerMixKnobs: (layerId) =>
        get().layerMixKnobs[layerId] ?? DEFAULT_LAYER_MIX_KNOBS[layerId],
      getLayerDefaultSound: (layerId) =>
        get().layerDefaults[layerId] ?? DEFAULT_LAYER_SOUND_DEFAULTS[layerId],
      getLoopSound: (layerId, loopId) =>
        get().loopSounds[loopSoundKey(layerId, loopId)] ??
        get().getLayerDefaultSound(layerId),
      getLayerDefaultMapping: (layerId) =>
        loopSoundToMapping(get().getLayerDefaultSound(layerId)),
      getLoopMapping: (layerId, loopId) =>
        loopSoundToMapping(get().getLoopSound(layerId, loopId)),

      setLayerVolume: (layerId, volume) => {
        const next = clamp01(volume);
        set((state) => ({
          layerVolumes: { ...state.layerVolumes, [layerId]: next },
        }));
        audioEngine.setLayerVolume(layerId, next);
      },

      setLayerSoundId: (layerId, soundId: SoundId) => {
        set((state) => ({
          layerDefaults: {
            ...state.layerDefaults,
            [layerId]: {
              ...state.layerDefaults[layerId],
              soundId,
            },
          },
        }));
      },

      setLayerKnobValue: (layerId, effect: KnobEffect, value) => {
        set((state) => ({
          layerDefaults: {
            ...state.layerDefaults,
            [layerId]: withUpdatedKnob(
              state.layerDefaults[layerId],
              effect,
              value,
            ),
          },
        }));
      },

      setLayerMixKnobValue: (layerId, effect: LayerMixEffect, value) => {
        set((state) => ({
          layerMixKnobs: {
            ...state.layerMixKnobs,
            [layerId]: {
              ...state.layerMixKnobs[layerId],
              [effect]: {
                ...state.layerMixKnobs[layerId][effect],
                value: clamp01(value),
              },
            },
          },
        }));
        audioEngine.updateLayerMix(layerId, get().getLayerMixKnobs(layerId));
      },

      setLoopSoundId: (layerId, loopId, soundId: SoundId) => {
        const key = loopSoundKey(layerId, loopId);
        set((state) => ({
          loopSounds: {
            ...state.loopSounds,
            [key]: {
              ...(state.loopSounds[key] ?? state.layerDefaults[layerId]),
              soundId,
            },
          },
        }));
        partEngine.updateLoopSynthMapping(
          layerId,
          loopId,
          get().getLoopMapping(layerId, loopId),
        );
      },

      setLoopKnobValue: (layerId, loopId, effect: KnobEffect, value) => {
        const key = loopSoundKey(layerId, loopId);
        set((state) => {
          const loopSound =
            state.loopSounds[key] ?? state.layerDefaults[layerId];
          return {
            loopSounds: {
              ...state.loopSounds,
              [key]: withUpdatedKnob(loopSound, effect, value),
            },
          };
        });
        partEngine.updateLoopSynthMapping(
          layerId,
          loopId,
          get().getLoopMapping(layerId, loopId),
        );
      },

      setLoopVolume: (layerId, loopId, volume) => {
        const key = loopSoundKey(layerId, loopId);
        set((state) => {
          const loopSound =
            state.loopSounds[key] ?? state.layerDefaults[layerId];
          return {
            loopSounds: {
              ...state.loopSounds,
              [key]: {
                ...loopSound,
                mix: { ...loopSound.mix, volume: clamp01(volume) },
              },
            },
          };
        });
        partEngine.updateLoopSynthMapping(
          layerId,
          loopId,
          get().getLoopMapping(layerId, loopId),
        );
      },

      setLoopPan: (layerId, loopId, pan) => {
        const key = loopSoundKey(layerId, loopId);
        set((state) => {
          const loopSound =
            state.loopSounds[key] ?? state.layerDefaults[layerId];
          return {
            loopSounds: {
              ...state.loopSounds,
              [key]: {
                ...loopSound,
                mix: { ...loopSound.mix, pan: clamp01(pan) },
              },
            },
          };
        });
        partEngine.updateLoopSynthMapping(
          layerId,
          loopId,
          get().getLoopMapping(layerId, loopId),
        );
      },

      createLoopMappingFromLayerDefault: (layerId, loopId) => {
        const key = loopSoundKey(layerId, loopId);
        set((state) => ({
          loopSounds: {
            ...state.loopSounds,
            [key]: cloneLoopSound(state.layerDefaults[layerId]),
          },
        }));
      },

      duplicateLoopMapping: (layerId, sourceLoopId, nextLoopId) => {
        const sourceKey = loopSoundKey(layerId, sourceLoopId);
        const nextKey = loopSoundKey(layerId, nextLoopId);
        set((state) => ({
          loopSounds: {
            ...state.loopSounds,
            [nextKey]: cloneLoopSound(
              state.loopSounds[sourceKey] ?? state.layerDefaults[layerId],
            ),
          },
        }));
      },

      deleteLoopMapping: (layerId, loopId) => {
        const key = loopSoundKey(layerId, loopId);
        set((state) => {
          const { [key]: _deleted, ...loopSounds } = state.loopSounds;
          return { loopSounds };
        });
      },

      addLoopEffect: (layerId, loopId, effectType: LoopEffectType) => {
        const key = loopSoundKey(layerId, loopId);
        set((state) => {
          const loopSound = state.loopSounds[key] ?? state.layerDefaults[layerId];
          if (loopSound.effects.some((e) => e.type === effectType)) return state;
          return {
            loopSounds: {
              ...state.loopSounds,
              [key]: {
                ...loopSound,
                effects: [...loopSound.effects, { ...DEFAULT_EFFECT_VALUES[effectType] }],
              },
            },
          };
        });
        partEngine.updateLoopSynthMapping(
          layerId,
          loopId,
          get().getLoopMapping(layerId, loopId),
        );
      },

      removeLoopEffect: (layerId, loopId, effectType: LoopEffectType) => {
        const key = loopSoundKey(layerId, loopId);
        set((state) => {
          const loopSound = state.loopSounds[key] ?? state.layerDefaults[layerId];
          return {
            loopSounds: {
              ...state.loopSounds,
              [key]: {
                ...loopSound,
                effects: loopSound.effects.filter((e) => e.type !== effectType),
              },
            },
          };
        });
        partEngine.updateLoopSynthMapping(
          layerId,
          loopId,
          get().getLoopMapping(layerId, loopId),
        );
      },
    }),
    {
      name: SOUND_STORE_KEY,
      version: 4,
      storage: createJSONStorage(() => localStorage),
      migrate: () => ({
        layerVolumes: DEFAULT_LAYER_VOLUMES,
        layerMixKnobs: DEFAULT_LAYER_MIX_KNOBS,
        layerDefaults: DEFAULT_LAYER_SOUND_DEFAULTS,
        loopSounds: DEFAULT_LOOP_SOUNDS,
      }),
    },
  ),
);
