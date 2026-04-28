import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  LayerId,
  LayerKnobEffect,
  LayerLoopId,
  LayerStoreState,
  LayerLoopInstance,
  LoopInstanceId,
  RepeatUnit,
} from "../types/layer";
import {
  DEFAULT_LAYERS,
  mergePersistedLayers,
  LAYER_SCHEMA_VERSION,
} from "./utils/persistence";

import { clamp } from "../utils";
import {
  canShiftLoopNotesOctaveBy,
  isRepeatDisabledForUnit,
  getRepeatEveryForUnit,
} from "../utils/layerState";

export const LAYER_STORE_KEY = "loop-soup-layers";

const initialLayers = DEFAULT_LAYERS;

/**
 * Purpose:
 * Normalizes repeatCount so persisted and runtime values always use nullable integers.
 *
 * Behavior:
 * - Converts null/undefined/non-finite values to null.
 * - Floors finite values and clamps to >= 0.
 *
 * Inputs:
 * - value: candidate repeat count from UI/persistence.
 *
 * Output:
 * - Normalized repeat count or null.
 *
 * Invariants:
 * - Returned number is always a non-negative integer.
 */
function sanitizeRepeatCount(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

/**
 * Purpose:
 * Applies a partial patch to one loop instance in the immutable layers tree.
 *
 * Behavior:
 * - Returns original layers when any addressed entity is missing.
 * - Rebuilds only the branch needed for the updated instance.
 *
 * Inputs:
 * - layers/layerId/loopId/instanceId: entity path to update.
 * - update: fields to merge into the target instance.
 *
 * Output:
 * - New LayersState with the patched instance, or original object.
 *
 * Invariants:
 * - Never mutates existing state objects.
 */
function updateInstanceInLayers(
  layers: LayerStoreState["layers"],
  layerId: LayerId,
  loopId: LayerLoopId,
  instanceId: LoopInstanceId,
  update: Partial<LayerLoopInstance>,
): LayerStoreState["layers"] {
  const layer = layers[layerId];
  if (!layer) return layers;
  const loop = layer.layerLoops[loopId];
  if (!loop) return layers;
  const instance = loop.loopInstances[instanceId];
  if (!instance) return layers;
  return {
    ...layers,
    [layerId]: {
      ...layer,
      layerLoops: {
        ...layer.layerLoops,
        [loopId]: {
          ...loop,
          loopInstances: {
            ...loop.loopInstances,
            [instanceId]: { ...instance, ...update },
          },
        },
      },
    },
  };
}

/**
 * Layer store
 *
 * Owns saved layer project data:
 * - layer default mapping
 * - numbered loops with per-loop mapping
 * - loop instance placements/repeat
 * - layer volume
 *
 * Definition-level edits (notes, spanBeats) go to loopDefinitionStore.
 */
export const useLayerStore = create<LayerStoreState>()(
  persist(
    (set, get) => ({
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

      setLayerSoundId: (id, soundId) =>
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

      setLayerKnobValue: (id, effect, value) =>
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
                        startBeat: loopInstance.startBeat,
                        repeatUnit: loopInstance.repeatUnit ?? "measures",
                        repeatEveryMeasuresMemory:
                          loopInstance.repeatEveryMeasuresMemory ?? null,
                        repeatEveryBeatsMemory:
                          loopInstance.repeatEveryBeatsMemory ?? null,
                        repeatCount: sanitizeRepeatCount(loopInstance.repeatCount),
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
        nextStartBeat,
      ) =>
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];
          const source = loop?.loopInstances[sourceLoopInstanceId];
          if (!source) {
            return state;
          }
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
                        startBeat: nextStartBeat,
                        repeatCount: sanitizeRepeatCount(source.repeatCount),
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

      shiftLoopNotesOctave: (layerId, loopId, delta) => {
        const loop = get().layers[layerId]?.layerLoops[loopId];
        if (!loop) return;
        if (!canShiftLoopNotesOctaveBy(loop.definition.notes, delta)) return;
        const notes = loop.definition.notes.map((n) => ({
          ...n,
          octave: n.octave + delta,
        }));
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: {
                ...state.layers[layerId].layerLoops,
                [loopId]: {
                  ...state.layers[layerId].layerLoops[loopId],
                  definition: {
                    ...state.layers[layerId].layerLoops[loopId].definition,
                    notes,
                  },
                },
              },
            },
          },
        }));
      },

      setLoopInstanceRepeatUnit: (
        layerId,
        loopId,
        instanceId,
        unit,
        beatsPerMeasure,
      ) =>
        set((state) => {
          const loop = state.layers[layerId]?.layerLoops[loopId];
          const instance = loop?.loopInstances[instanceId];

          const spanBeats = loop.definition.spanBeats;
          let nextMeasMem = instance.repeatEveryMeasuresMemory;
          let nextBeatMem = instance.repeatEveryBeatsMemory;
          if (
            isRepeatDisabledForUnit(
              spanBeats,
              beatsPerMeasure,
              unit,
              nextMeasMem,
            )
          )
            nextMeasMem = null;
          if (
            isRepeatDisabledForUnit(
              spanBeats,
              beatsPerMeasure,
              unit,
              nextBeatMem,
            )
          )
            nextBeatMem = null;
          return {
            layers: updateInstanceInLayers(
              state.layers,
              layerId,
              loopId,
              instanceId,
              {
                repeatUnit: unit,
                repeatEveryMeasuresMemory: nextMeasMem,
                repeatEveryBeatsMemory: nextBeatMem,
              },
            ),
          };
        }),

      toggleLoopInstanceRepeatEvery: (
        layerId,
        loopId,
        instanceId,
        value,
        beatsPerMeasure,
      ) =>
        set((state) => {
          const loop = state.layers[layerId].layerLoops[loopId];
          const instance = loop.loopInstances[instanceId];
          const unit = instance.repeatUnit;
          const activeRepeatEvery = getRepeatEveryForUnit(unit, instance);
          let update: Partial<LayerLoopInstance>;
          if (activeRepeatEvery === value) {
            update = {
              repeatEveryMeasuresMemory:
                unit === "measures" ? null : instance.repeatEveryMeasuresMemory,
              repeatEveryBeatsMemory:
                unit === "beats" ? null : instance.repeatEveryBeatsMemory,
              repeatCount: null,
            };
          } else {
            update = {
              repeatUnit: unit,
              repeatEveryMeasuresMemory:
                unit === "measures"
                  ? value
                  : instance.repeatEveryMeasuresMemory,
              repeatEveryBeatsMemory:
                unit === "beats" ? value : instance.repeatEveryBeatsMemory,
            };
          }
          return {
            layers: updateInstanceInLayers(
              state.layers,
              layerId,
              loopId,
              instanceId,
              update,
            ),
          };
        }),

      setLoopInstanceStartBeat: (layerId, loopId, instanceId, startBeat) =>
        set((state) => {
          const instance =
            state.layers[layerId]?.layerLoops[loopId]?.loopInstances[
              instanceId
            ];
          if (!instance) return state;
          return {
            layers: updateInstanceInLayers(
              state.layers,
              layerId,
              loopId,
              instanceId,
              {
                startBeat,
              },
            ),
          };
        }),
    }),
    {
      name: LAYER_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        schemaVersion: LAYER_SCHEMA_VERSION,
        layers: state.layers,
      }),
      merge: (persistedState, currentState) => {
        const layers = mergePersistedLayers(persistedState);
        return { ...currentState, layers };
      },
    },
  ),
);
