import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  LayerId,
  LayerKnobEffect,
  LayerLoopId,
  LayerLoopInstance,
  LayersState,
  RepeatUnit,
} from "../types/layer";
import type { LoopInstanceId } from "../types/layer";
import {
  DEFAULT_LAYERS,
  mergePersistedLayers,
  LAYER_SCHEMA_VERSION,
} from "./utils/persistence";

import { clamp } from "../utils";
import {
  isRepeatDisabledForUnit,
  getRepeatEveryForUnit,
} from "../utils/layerState";

export const LAYER_STORE_KEY = "loop-soup-layers";

const initialLayers = DEFAULT_LAYERS;

/** Update a single instance within the immutable layers tree. */
function updateInstanceInLayers(
  layers: LayersState,
  layerId: LayerId,
  LayerLoopId: LayerLoopId,
  instanceId: LoopInstanceId,
  update: Partial<LayerLoopInstance>,
): LayersState {
  const layer = layers[layerId];
  if (!layer) return layers;
  const loop = layer.layerLoops[LayerLoopId];
  if (!loop) return layers;
  const instance = loop.loopInstances[instanceId];
  if (!instance) return layers;
  return {
    ...layers,
    [layerId]: {
      ...layer,
      layerLoops: {
        ...layer.layerLoops,
        [LayerLoopId]: {
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

export interface LayerStoreState {
  layers: LayersState;

  setLayerVolume: (id: LayerId, volume: number) => void;
  setLayerSoundId: (id: LayerId, soundId: string | null) => void;
  setLayerKnobValue: (
    id: LayerId,
    effect: LayerKnobEffect,
    value: number,
  ) => void;

  addLoopInstance: (
    layerId: LayerId,
    LayerLoopId: LayerLoopId,
    loopInstance: {
      id: LoopInstanceId;
      startBeat: number;
      repeatUnit?: RepeatUnit;
      repeatEveryMeasuresMemory?: number | null;
      repeatEveryBeatsMemory?: number | null;
      repeatEndBeat?: number | null;
    },
  ) => void;

  duplicateLoopInstance: (
    layerId: LayerId,
    LayerLoopId: LayerLoopId,
    sourceLoopInstanceId: LoopInstanceId,
    nextLoopInstanceId: LoopInstanceId,
    nextStartBeat: number,
  ) => void;

  setLoopSoundId: (
    layerId: LayerId,
    LayerLoopId: LayerLoopId,
    soundId: string | null,
  ) => void;

  setLoopKnobValue: (
    layerId: LayerId,
    LayerLoopId: LayerLoopId,
    effect: LayerKnobEffect,
    value: number,
  ) => void;

  shiftLoopNotesOctave: (
    layerId: LayerId,
    loopId: LayerLoopId,
    delta: number,
  ) => void;

  setLoopInstanceRepeatUnit: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
    unit: RepeatUnit,
    beatsPerMeasure: number,
  ) => void;
  toggleLoopInstanceRepeatEvery: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
    value: number,
    beatsPerMeasure: number,
  ) => void;
  setLoopInstanceStartBeat: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
    startBeat: number,
  ) => void;
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

      addLoopInstance: (layerId, LayerLoopId, loopInstance) =>
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[LayerLoopId];
          if (!loop) return state;
          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                layerLoops: {
                  ...layer.layerLoops,
                  [LayerLoopId]: {
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
                        repeatEndBeat: loopInstance.repeatEndBeat ?? null,
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
        LayerLoopId,
        sourceLoopInstanceId,
        nextLoopInstanceId,
        nextStartBeat,
      ) =>
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[LayerLoopId];
          const source = loop?.loopInstances[sourceLoopInstanceId];
          if (!source) {
            return state;
          }
          const nextRepeatEndBeat =
            typeof source.repeatEndBeat === "number"
              ? nextStartBeat + (source.repeatEndBeat - source.startBeat)
              : null;
          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                layerLoops: {
                  ...layer.layerLoops,
                  [LayerLoopId]: {
                    ...loop,
                    loopInstances: {
                      ...loop.loopInstances,
                      [nextLoopInstanceId]: {
                        ...source,
                        id: nextLoopInstanceId,
                        startBeat: nextStartBeat,
                        repeatEndBeat: nextRepeatEndBeat,
                      },
                    },
                  },
                },
              },
            },
          };
        }),

      setLoopSoundId: (layerId, LayerLoopId, soundId) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: {
                ...state.layers[layerId].layerLoops,
                [LayerLoopId]: {
                  ...state.layers[layerId].layerLoops[LayerLoopId],
                  mapping: {
                    ...state.layers[layerId].layerLoops[LayerLoopId].mapping,
                    soundId,
                  },
                },
              },
            },
          },
        })),

      setLoopKnobValue: (layerId, LayerLoopId, effect, value) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: {
                ...state.layers[layerId].layerLoops,
                [LayerLoopId]: {
                  ...state.layers[layerId].layerLoops[LayerLoopId],
                  mapping: {
                    ...state.layers[layerId].layerLoops[LayerLoopId].mapping,
                    knobsByEffect: {
                      ...state.layers[layerId].layerLoops[LayerLoopId].mapping
                        .knobsByEffect,
                      [effect]: {
                        ...state.layers[layerId].layerLoops[LayerLoopId].mapping
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
              repeatEndBeat: null,
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
          const nextEnd =
            instance.repeatEndBeat != null &&
            instance.repeatEndBeat <= startBeat
              ? startBeat + 1
              : instance.repeatEndBeat;
          return {
            layers: updateInstanceInLayers(
              state.layers,
              layerId,
              loopId,
              instanceId,
              {
                startBeat,
                repeatEndBeat: nextEnd,
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
