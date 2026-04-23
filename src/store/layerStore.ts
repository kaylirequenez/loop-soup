import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  Layer,
  LayerId,
  LayerKnobEffect,
  LayerKnobsByEffect,
  LayerLoopId,
  LayersState,
} from "../types/layer";
import type { LoopInstanceId } from "../types/loop";
import { buildInitialProject, mergePersistedLayers } from "./utils/persistence";
import { useLoopDefinitionStore } from "./loopDefinitionStore";
import { clamp } from "../utils";

export const LAYER_STORE_KEY = "loop-soup-layers";

const { layers: initialLayers, definitions: initialDefinitions } =
  buildInitialProject();
useLoopDefinitionStore.setState({ definitions: initialDefinitions });

export interface LayerStoreState {
  layers: LayersState;

  setLayerVolume: (id: LayerId, volume: number) => void;
  setLayerKnobValue: (
    id: LayerId,
    effect: LayerKnobEffect,
    value: number,
  ) => void;

  setLayerDefaultSoundId: (id: LayerId, soundId: string | null) => void;
  setLayerDefaultKnobValue: (
    id: LayerId,
    effect: LayerKnobEffect,
    value: number,
  ) => void;

  addLoopInstance: (
    layerId: LayerId,
    loopId: LayerLoopId,
    loopInstance: {
      id: LoopInstanceId;
      startMeasure: number;
      repeatUnit?: "measures" | "beats";
      repeatEveryMeasuresMemory?: number | null;
      repeatEveryBeatsMemory?: number | null;
      repeatEndMeasure?: number | null;
    },
  ) => void;

  duplicateLoopInstance: (
    layerId: LayerId,
    loopId: LayerLoopId,
    sourceLoopInstanceId: LoopInstanceId,
    nextLoopInstanceId: LoopInstanceId,
    nextStartMeasure: number,
  ) => void;

  setLoopSoundId: (
    layerId: LayerId,
    loopId: LayerLoopId,
    soundId: string | null,
  ) => void;

  setLoopKnobValue: (
    layerId: LayerId,
    loopId: LayerLoopId,
    effect: LayerKnobEffect,
    value: number,
  ) => void;
}

/**
 * Layer store
 *
 * Owns saved layer project data only:
 * - layer default mapping
 * - numbered loops with per-loop mapping
 * - loop instance placements/repeat
 * - layer volume
 *
 */
export const useLayerStore = create<LayerStoreState>()(
  persist(
    (set) => ({
      layers: initialLayers,

      setLayerVolume: (id, volume) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [id]: {
              ...state.layers[id],
              volume: clamp(volume, 0, 1),
            },
          },
        })),

      setLayerKnobValue: (id, effect, value) =>
        set((state) => {
          const layer = state.layers[id];
          const knobs = (["filter", "reverb"] as const).map((eff) => ({
            effect: eff,
            value:
              eff === effect
                ? clamp(value, 0, 1)
                : (layer.defaultMapping.knobsByEffect[eff]?.value ?? 0.5),
            label: layer.defaultMapping.knobsByEffect[eff]?.label ?? eff,
          }));
          const knobsByEffect: LayerKnobsByEffect = {};
          for (const k of knobs) {
            knobsByEffect[k.effect] = { value: k.value, label: k.label };
          }
          return {
            layers: {
              ...state.layers,
              [id]: {
                ...layer,
                defaultMapping: {
                  ...layer.defaultMapping,
                  knobsByEffect: {
                    ...layer.defaultMapping.knobsByEffect,
                    ...knobsByEffect,
                  },
                },
              },
            },
          };
        }),

      setLayerDefaultSoundId: (id, soundId) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [id]: {
              ...state.layers[id],
              defaultMapping: {
                ...state.layers[id].defaultMapping,
                soundId,
              },
            },
          },
        })),

      setLayerDefaultKnobValue: (id, effect, value) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [id]: {
              ...state.layers[id],
              defaultMapping: {
                ...state.layers[id].defaultMapping,
                knobsByEffect: {
                  ...state.layers[id].defaultMapping.knobsByEffect,
                  [effect]: {
                    ...state.layers[id].defaultMapping.knobsByEffect[effect],
                    value: clamp(value, 0, 1),
                  },
                },
              },
            },
          },
        })),

      addLoopInstance: (layerId, loopId, loopInstance) =>
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];
          if (!loop) return state;
          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                layerLoops: {
                  ...layer.layerLoops,
                  [loopId]: {
                    ...loop,
                    loopInstances: {
                      ...loop.loopInstances,
                      [loopInstance.id]: {
                        id: loopInstance.id,
                        startMeasure: loopInstance.startMeasure,
                        repeatUnit: loopInstance.repeatUnit ?? "measures",
                        repeatEveryMeasuresMemory:
                          loopInstance.repeatEveryMeasuresMemory ?? null,
                        repeatEveryBeatsMemory:
                          loopInstance.repeatEveryBeatsMemory ?? null,
                        repeatEndMeasure: loopInstance.repeatEndMeasure ?? null,
                      },
                    },
                  },
                },
              },
            },
          };
        }),

      duplicateLoopInstance: (
        layerId,
        loopId,
        sourceLoopInstanceId,
        nextLoopInstanceId,
        nextStartMeasure,
      ) =>
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];
          const source = loop?.loopInstances[sourceLoopInstanceId];
          if (!source) {
            return state;
          }
          const nextRepeatEndMeasure =
            typeof source.repeatEndMeasure === "number"
              ? nextStartMeasure +
                (source.repeatEndMeasure - source.startMeasure)
              : null;
          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                layerLoops: {
                  ...layer.layerLoops,
                  [loopId]: {
                    ...loop,
                    loopInstances: {
                      ...loop.loopInstances,
                      [nextLoopInstanceId]: {
                        ...source,
                        id: nextLoopInstanceId,
                        startMeasure: nextStartMeasure,
                        repeatEndMeasure: nextRepeatEndMeasure,
                      },
                    },
                  },
                },
              },
            },
          };
        }),

      setLoopSoundId: (layerId, loopId, soundId) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: {
                ...state.layers[layerId].layerLoops,
                [loopId]: {
                  ...state.layers[layerId].layerLoops[loopId],
                  mapping: {
                    ...state.layers[layerId].layerLoops[loopId].mapping,
                    soundId,
                  },
                },
              },
            },
          },
        })),

      setLoopKnobValue: (layerId, loopId, effect, value) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: {
                ...state.layers[layerId].layerLoops,
                [loopId]: {
                  ...state.layers[layerId].layerLoops[loopId],
                  mapping: {
                    ...state.layers[layerId].layerLoops[loopId].mapping,
                    knobsByEffect: {
                      ...state.layers[layerId].layerLoops[loopId].mapping
                        .knobsByEffect,
                      [effect]: {
                        ...state.layers[layerId].layerLoops[loopId].mapping
                          .knobsByEffect[effect],
                        value: clamp(value, 0, 1),
                      },
                    },
                  },
                },
              },
            },
          },
        })),
    }),
    {
      name: LAYER_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        layers: state.layers,
      }),
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Record<string, unknown>;
        if (!p.layers || typeof p.layers !== "object") {
          return currentState;
        }
        const { layers, definitions } = mergePersistedLayers(p.layers);
        useLoopDefinitionStore.setState((s) => ({
          definitions: { ...s.definitions, ...definitions },
        }));
        return { ...currentState, layers };
      },
    },
  ),
);
