import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  LayerId,
  LayerKnobEffect,
  LayerLoop,
  LayerLoopId,
  LayerStoreState,
  LayerLoopInstance,
  LoopDefinition,
  LoopInstanceId,
  LoopNote,
} from "../types/layer";
import { useLayerEditorStore } from "./layerEditorStore";
import {
  DEFAULT_LAYERS,
  mergePersistedLayers,
  LAYER_SCHEMA_VERSION,
} from "./utils/persistence";

import { clamp } from "../utils";
import { loopTimeline } from "../utils/loopTimeline";
import {
  canShiftLoopNotesOctaveBy,
  isRepeatDisabledForUnit,
  getRepeatEveryForUnit,
} from "../utils/layerState";

export const LAYER_STORE_KEY = "loop-soup-layers";

const initialLayers = DEFAULT_LAYERS;

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
  const loop = layer.layerLoops[loopId];
  const instance = loop.loopInstances[instanceId];
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

function updateLoopInLayers(
  layers: LayerStoreState["layers"],
  layerId: LayerId,
  loopId: LayerLoopId,
  patch: {
    definition?: Partial<LoopDefinition>;
    loopInstances?: Record<LoopInstanceId, LayerLoopInstance>;
  },
): LayerStoreState["layers"] {
  const layer = layers[layerId];
  const loop = layer.layerLoops[loopId];
  return {
    ...layers,
    [layerId]: {
      ...layer,
      layerLoops: {
        ...layer.layerLoops,
        [loopId]: {
          ...loop,
          definition: patch.definition
            ? { ...loop.definition, ...patch.definition }
            : loop.definition,
          loopInstances: patch.loopInstances ?? loop.loopInstances,
        },
      },
    },
  };
}

function loopDefinitionHasNotes(definition: LoopDefinition): boolean {
  return definition.notes.length > 0;
}

function lengthInBeatFromAbsoluteEnd(
  instance0StartBeat: number,
  note: LoopNote,
  absoluteEndBeat: number,
): number {
  return (
    absoluteEndBeat - instance0StartBeat - note.beatIndex - note.startInBeat
  );
}

export function definitionSpanBeatsFromLastNote(lastNote: LoopNote): number {
  const len = lastNote.lengthInBeat;
  if (len == null) {
    throw new Error("expected last note to have lengthInBeat before span");
  }
  return Math.ceil(lastNote.beatIndex + lastNote.startInBeat + len);
}

/**
 * Layer store
 *
 * Owns saved layer project data:
 * - layer default mapping
 * - numbered loops with per-loop mapping
 * - loop instance placements/repeat
 * - layer volume
 * - loop definitions (notes, span)
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

      addLoopInstance: (layerId, loopId, loopInstance) => {
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];
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
                        repeatCount: loopInstance.repeatCount ?? null,
                      },
                    },
                  },
                },
              },
            },
          };
        });
        syncTimelineLoop(layerId, loopId);
      },

      duplicateLoopInstance: (
        layerId,
        loopId,
        sourceLoopInstanceId,
        nextLoopInstanceId,
        nextStartBeat,
      ) => {
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];
          const source = loop?.loopInstances[sourceLoopInstanceId];
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
                        id: nextLoopInstanceId,
                        startBeat: nextStartBeat,
                        repeatCount: source.repeatCount,
                      },
                    },
                  },
                },
              },
            },
          };
        });
        syncTimelineLoop(layerId, loopId);
      },

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

      setLoopRepeatUnit: (layerId, loopId, unit, beatsPerMeasure) => {
        set((state) => {
          const loop = state.layers[layerId]?.layerLoops[loopId];
          if (!loop) return state;
          const spanBeats = loop.definition.spanBeats;
          let nextMeasMem = loop.definition.repeatEveryMeasuresMemory;
          let nextBeatMem = loop.definition.repeatEveryBeatsMemory;
          if (spanBeats != null) {
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
          }
          return {
            layers: updateLoopInLayers(state.layers, layerId, loopId, {
              definition: {
                repeatUnit: unit,
                repeatEveryMeasuresMemory: nextMeasMem,
                repeatEveryBeatsMemory: nextBeatMem,
              },
            }),
          };
        });
        syncTimelineLoop(layerId, loopId);
      },

      toggleLoopRepeatEvery: (layerId, loopId, value) => {
        set((state) => {
          const loop = state.layers[layerId].layerLoops[loopId];
          const unit = loop.definition.repeatUnit;
          const activeRepeatEvery = getRepeatEveryForUnit(
            unit,
            loop.definition,
          );
          if (activeRepeatEvery === value) {
            const nextInstances = Object.fromEntries(
              Object.entries(loop.loopInstances).map(([id, inst]) => [
                Number(id),
                { ...inst, repeatCount: null },
              ]),
            );
            return {
              layers: updateLoopInLayers(state.layers, layerId, loopId, {
                definition: {
                  repeatEveryMeasuresMemory:
                    unit === "measures"
                      ? null
                      : loop.definition.repeatEveryMeasuresMemory,
                  repeatEveryBeatsMemory:
                    unit === "beats"
                      ? null
                      : loop.definition.repeatEveryBeatsMemory,
                },
                loopInstances: nextInstances,
              }),
            };
          }
          return {
            layers: updateLoopInLayers(state.layers, layerId, loopId, {
              definition: {
                repeatEveryMeasuresMemory:
                  unit === "measures"
                    ? value
                    : loop.definition.repeatEveryMeasuresMemory,
                repeatEveryBeatsMemory:
                  unit === "beats"
                    ? value
                    : loop.definition.repeatEveryBeatsMemory,
              },
            }),
          };
        });
        syncTimelineLoop(layerId, loopId);
      },

      setLoopInstanceStartBeat: (layerId, loopId, instanceId, startBeat) => {
        set((state) => {
          const instance =
            state.layers[layerId]?.layerLoops[loopId]?.loopInstances[
              instanceId
            ];
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
        });
        syncTimelineLoop(layerId, loopId);
      },

      addNewLoop: (layerId) => {
        const layer = get().layers[layerId];

        const existingIds = Object.keys(layer.layerLoops).map(Number);
        const newLoopId: LayerLoopId =
          existingIds.length > 0 ? Math.max(...existingIds) + 1 : 0;

        const newLoop: LayerLoop = {
          id: newLoopId,
          definition: {
            spanBeats: null,
            notes: [],
            repeatUnit: "measures",
            repeatEveryMeasuresMemory: null,
            repeatEveryBeatsMemory: null,
          },
          mapping: {
            ...layer.defaultMapping,
            knobsByEffect: { ...layer.defaultMapping.knobsByEffect },
          },
          knobOrder: [...layer.knobOrder],
          loopInstances: {
            0: {
              id: 0,
              startBeat: -1,
              repeatCount: null,
            },
          },
        };

        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: {
                ...state.layers[layerId].layerLoops,
                [newLoopId]: newLoop,
              },
            },
          },
        }));

        const editor = useLayerEditorStore.getState();
        editor.armNewLoopRecording(layerId, newLoopId);
        syncTimelineLoop(layerId, newLoopId);
      },

      deleteLastLoop: (layerId) => {
        const layer = get().layers[layerId];
        const ids = Object.keys(layer.layerLoops).map(Number);
        if (ids.length === 0) return;
        const lastId = Math.max(...ids);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [lastId]: _removed, ...remaining } = layer.layerLoops;
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: { ...state.layers[layerId], layerLoops: remaining },
          },
        }));
        syncTimelineLoop(layerId, lastId);
      },

      addLoopNote: (layerId, loopId, pitchClass, octave, absoluteStartBeat) => {
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];

          const inst0 = loop.loopInstances[0];
          const hasNotes = loopDefinitionHasNotes(loop.definition);
          const anchor = hasNotes
            ? inst0.startBeat
            : Math.floor(absoluteStartBeat);
          const rel = absoluteStartBeat - anchor;
          const beatIndex = Math.floor(rel);
          const startInBeat = rel - beatIndex;
          const newNote: LoopNote = {
            pitchClass,
            octave,
            beatIndex,
            startInBeat,
            lengthInBeat: null,
          };

          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                layerLoops: {
                  ...layer.layerLoops,
                  [loopId]: {
                    ...loop,
                    loopInstances: hasNotes
                      ? loop.loopInstances
                      : {
                          0: { ...inst0, startBeat: anchor },
                        },
                    definition: {
                      ...loop.definition,
                      notes: [...loop.definition.notes, newNote],
                    },
                  },
                },
              },
            },
          };
        });
        const loopAfter =
          useLayerStore.getState().layers[layerId].layerLoops[loopId];
        loopTimeline.appendRecordingNote(
          layerId,
          loopId,
          loopAfter.loopInstances[0].id,
          loopAfter.definition.notes.length - 1,
          absoluteStartBeat,
        );
      },

      endLoopNote: (layerId, loopId, absoluteEndBeat) => {
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];

          const notes = loop.definition.notes;
          const inst0Start = loop.loopInstances[0].startBeat;
          const lastIdxInner = notes.length - 1;
          const last = notes[lastIdxInner];
          const lengthInBeat = lengthInBeatFromAbsoluteEnd(
            inst0Start,
            last,
            absoluteEndBeat,
          );
          const nextNotes = notes.slice(0, lastIdxInner);
          nextNotes.push({ ...last, lengthInBeat });

          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                layerLoops: {
                  ...layer.layerLoops,
                  [loopId]: {
                    ...loop,
                    definition: {
                      ...loop.definition,
                      notes: nextNotes,
                    },
                  },
                },
              },
            },
          };
        });

        loopTimeline.patchRecordingNoteEnd(layerId, loopId, absoluteEndBeat);
      },

      finalizeLoop: (layerId, loopId, endBeat) => {
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];
          if (!loop) return state;

          if (!loopDefinitionHasNotes(loop.definition)) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [loopId]: _removed, ...remaining } = layer.layerLoops;
            return {
              layers: {
                ...state.layers,
                [layerId]: { ...layer, layerLoops: remaining },
              },
            };
          }

          const notes = [...loop.definition.notes];
          const inst0Start = loop.loopInstances[0].startBeat;
          const lastIdx = notes.length - 1;
          let lastNote = notes[lastIdx];

          if (lastNote.lengthInBeat == null) {
            lastNote = {
              ...lastNote,
              lengthInBeat: lengthInBeatFromAbsoluteEnd(
                inst0Start,
                lastNote,
                endBeat,
              ),
            };
            notes[lastIdx] = lastNote;
          }

          const spanBeats = definitionSpanBeatsFromLastNote(lastNote);

          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                layerLoops: {
                  ...layer.layerLoops,
                  [loopId]: {
                    ...loop,
                    definition: {
                      ...loop.definition,
                      notes,
                      spanBeats,
                    },
                  },
                },
              },
            },
          };
        });
        syncTimelineLoop(layerId, loopId);
      },
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

function syncTimelineLoop(layerId: LayerId, loopId: LayerLoopId): void {
  loopTimeline.rebuildLoop(layerId, loopId, useLayerStore.getState().layers);
}
