import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  LayerId,
  LayerLoop,
  LayerLoopId,
  LayerStoreState,
  LayerLoopInstance,
  LoopDefinition,
  LoopNote,
} from "../types/layer";
import { useLayerEditorStore } from "./layerEditorStore";
import { DEFAULT_LAYERS } from "./utils/defaults";

import { clamp } from "../utils";
import { loopTimeline } from "../utils/loopTimeline";
import { audioEngine } from "../audio/audioEngine";
import {
  isRepeatDisabledForUnit,
  getRepeatEveryForUnit,
} from "../utils/layerState";
import {
  snapStartBeatNearNextBoundary,
  snapEndBeatNearBoundary,
  findLastPlayableInstanceForCompositionEnd,
  reflowInstanceRepeatsForDefinition,
  getExpandedRepeatInfoForLastInstance,
  getValidInstanceInfoForProposedStart,
  fitRepeatCountToWindow,
} from "../utils/loopInstanceUtils";

export const LAYER_STORE_KEY = "loop-soup-layers";

const initialLayers: LayerStoreState["layers"] = DEFAULT_LAYERS;

function withReflowedLoopInstances(
  loop: LayerLoop,
  compositionDims: { beatsPerMeasure: number; compositionEndBeat: number },
): LayerLoopInstance[] {
  if (loop.definition.spanBeats == null || loop.loopInstances.length === 0) {
    return loop.loopInstances;
  }
  const reflowed = reflowInstanceRepeatsForDefinition(
    loop.loopInstances,
    loop.definition,
    compositionDims,
  );
  return loop.loopInstances.map((instance, idx) => ({
    ...instance,
    repeatCount: reflowed[idx].repeatCount,
    endBeat: reflowed[idx].endBeat,
  }));
}

/** Applies `nextDefinition`, then recomputes `repeatCount` / `endBeat` on every row. */
function commitLoopRepeatDefinitionReflow(
  layers: LayerStoreState["layers"],
  layerId: LayerId,
  loopId: LayerLoopId,
  nextDefinition: LoopDefinition,
  compositionDims: { beatsPerMeasure: number; compositionEndBeat: number },
): LayerStoreState["layers"] {
  const loop = layers[layerId]?.layerLoops[loopId];
  if (!loop) return layers;
  return updateLoopInLayers(layers, layerId, loopId, {
    definition: nextDefinition,
    loopInstances: withReflowedLoopInstances(
      {
        ...loop,
        definition: nextDefinition,
      },
      compositionDims,
    ),
  });
}

function updateInstanceInLayers(
  layers: LayerStoreState["layers"],
  layerId: LayerId,
  loopId: LayerLoopId,
  instanceId: number,
  update: Partial<LayerLoopInstance>,
): LayerStoreState["layers"] {
  const layer = layers[layerId];
  const loop = layer.layerLoops[loopId];
  return {
    ...layers,
    [layerId]: {
      ...layer,
      layerLoops: layer.layerLoops.map((l, i) =>
        i !== loopId
          ? l
          : {
              ...loop,
              loopInstances: loop.loopInstances.map((inst, j) =>
                j === instanceId ? { ...inst, ...update } : inst,
              ),
            },
      ),
    },
  };
}

function updateLoopInLayers(
  layers: LayerStoreState["layers"],
  layerId: LayerId,
  loopId: LayerLoopId,
  patch: {
    definition?: Partial<LoopDefinition>;
    loopInstances?: LayerLoopInstance[];
  },
): LayerStoreState["layers"] {
  const layer = layers[layerId];
  const loop = layer.layerLoops[loopId];
  return {
    ...layers,
    [layerId]: {
      ...layer,
      layerLoops: layer.layerLoops.map((l, i) =>
        i !== loopId
          ? l
          : {
              ...loop,
              definition: patch.definition
                ? { ...loop.definition, ...patch.definition }
                : loop.definition,
              loopInstances: patch.loopInstances ?? loop.loopInstances,
            },
      ),
    },
  };
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

      setLayerKnobValue: (id, effect, value) => {
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
        }));
        audioEngine.setLayerEnvelope(
          id,
          useLayerStore.getState().layers[id].defaultMapping.knobsByEffect,
        );
      },

      addLoopInstance: (
        layerId,
        loopId,
        startBeat,
        compositionDims,
        referenceInstanceId,
      ) => {
        useLayerEditorStore.setState({ selectedInstanceId: null });
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];

          const spanBeats = loop.definition.spanBeats;
          const source =
            referenceInstanceId == null
              ? null
              : (loop.loopInstances[referenceInstanceId] ?? null);
          const proposedRepeat = source?.repeatCount ?? null;
          if (spanBeats == null) {
            return state;
          }

          const placement = getValidInstanceInfoForProposedStart(
            loop.loopInstances,
            {
              startBeat,
              repeatCount: proposedRepeat,
              endBeat: source?.endBeat ?? null,
            },
            loop.definition,
            compositionDims,
          );
          if (!placement) return state;

          const newRow: LayerLoopInstance = {
            startBeat,
            repeatCount: placement.repeatCount,
            endBeat: placement.endBeat,
          };
          const nextInstances = [
            ...loop.loopInstances.slice(0, placement.insertIndex),
            newRow,
            ...loop.loopInstances.slice(placement.insertIndex),
          ];

          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                layerLoops: layer.layerLoops.map((l, i) =>
                  i !== loopId ? l : { ...loop, loopInstances: nextInstances },
                ),
              },
            },
          };
        });
        syncTimelineLoop(layerId, loopId);
      },

      deleteLoopInstance: (layerId, loopId, instanceId) => {
        const loop = get().layers[layerId]?.layerLoops[loopId];
        if (!loop || !loop.loopInstances[instanceId]) return;
        const editor = useLayerEditorStore.getState();
        if (
          editor.selectedLayerId === layerId &&
          editor.selectedLoopId === loopId &&
          editor.selectedInstanceId === instanceId
        ) {
          useLayerEditorStore.setState({ selectedInstanceId: null });
        }
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: state.layers[layerId].layerLoops.map((l, i) =>
                i !== loopId
                  ? l
                  : {
                      ...loop,
                      loopInstances: loop.loopInstances.filter(
                        (_, j) => j !== instanceId,
                      ),
                    },
              ),
            },
          },
        }));
        syncTimelineLoop(layerId, loopId);
      },

      setLoopSoundId: (layerId, loopId, soundId) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: state.layers[layerId].layerLoops.map((l, i) =>
                i !== loopId ? l : { ...l, mapping: { ...l.mapping, soundId } },
              ),
            },
          },
        })),

      setLoopKnobValue: (layerId, loopId, effect, value) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: state.layers[layerId].layerLoops.map((l, i) =>
                i !== loopId
                  ? l
                  : {
                      ...l,
                      mapping: {
                        ...l.mapping,
                        knobsByEffect: {
                          ...l.mapping.knobsByEffect,
                          [effect]: {
                            ...l.mapping.knobsByEffect[effect],
                            value: clamp(value, 0, 1),
                          },
                        },
                      },
                    },
              ),
            },
          },
        })),

      shiftLoopNotesOctave: (layerId, loopId, delta) => {
        const loop = get().layers[layerId]?.layerLoops[loopId];
        const notes = loop.definition.notes.map((n) => ({
          ...n,
          octave: n.octave + delta,
        }));
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: state.layers[layerId].layerLoops.map((l, i) =>
                i !== loopId
                  ? l
                  : { ...l, definition: { ...l.definition, notes } },
              ),
            },
          },
        }));
      },

      setLoopRepeatUnit: (layerId, loopId, unit, compositionDims) => {
        const { beatsPerMeasure } = compositionDims;
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
          const nextDefinition: LoopDefinition = {
            ...loop.definition,
            repeatUnit: unit,
            repeatEveryMeasuresMemory: nextMeasMem,
            repeatEveryBeatsMemory: nextBeatMem,
          };
          return {
            layers: commitLoopRepeatDefinitionReflow(
              state.layers,
              layerId,
              loopId,
              nextDefinition,
              compositionDims,
            ),
          };
        });
        syncTimelineLoop(layerId, loopId);
      },

      toggleLoopRepeatEvery: (layerId, loopId, value, compositionDims) => {
        set((state) => {
          const loop = state.layers[layerId].layerLoops[loopId];
          const unit = loop.definition.repeatUnit;
          const activeRepeatEvery = getRepeatEveryForUnit(
            unit,
            loop.definition,
          );
          if (activeRepeatEvery === value) {
            const nextDefinition: LoopDefinition = {
              ...loop.definition,
              repeatEveryMeasuresMemory:
                unit === "measures"
                  ? null
                  : loop.definition.repeatEveryMeasuresMemory,
              repeatEveryBeatsMemory:
                unit === "beats"
                  ? null
                  : loop.definition.repeatEveryBeatsMemory,
            };
            return {
              layers: commitLoopRepeatDefinitionReflow(
                state.layers,
                layerId,
                loopId,
                nextDefinition,
                compositionDims,
              ),
            };
          }
          const nextDefinition: LoopDefinition = {
            ...loop.definition,
            repeatEveryMeasuresMemory:
              unit === "measures"
                ? value
                : loop.definition.repeatEveryMeasuresMemory,
            repeatEveryBeatsMemory:
              unit === "beats" ? value : loop.definition.repeatEveryBeatsMemory,
          };
          return {
            layers: commitLoopRepeatDefinitionReflow(
              state.layers,
              layerId,
              loopId,
              nextDefinition,
              compositionDims,
            ),
          };
        });
        syncTimelineLoop(layerId, loopId);
      },

      setLoopInstanceStartBeat: (
        layerId,
        loopId,
        instanceId,
        startBeat,
        compositionDims,
      ) => {
        set((state) => {
          const loop = state.layers[layerId]?.layerLoops[loopId];
          const instance = loop?.loopInstances[instanceId];
          if (!loop || !instance) return state;
          if (loop.definition.spanBeats == null) return state;
          // End stays fixed; start moves, so the available window shrinks/grows.
          const maxEndBeat =
            instance.endBeat ?? compositionDims.compositionEndBeat;
          const fitted = fitRepeatCountToWindow(
            { startBeat, repeatCount: instance.repeatCount },
            maxEndBeat,
            loop.definition,
            compositionDims.beatsPerMeasure,
          );
          if (!fitted) return state;
          return {
            layers: updateInstanceInLayers(
              state.layers,
              layerId,
              loopId,
              instanceId,
              {
                startBeat,
                repeatCount: fitted.repeatCount,
                endBeat: fitted.endBeat,
              },
            ),
          };
        });
        syncTimelineLoop(layerId, loopId);
      },

      setLoopInstanceEndBeat: (
        layerId,
        loopId,
        instanceId,
        endBeat,
        compositionDims,
      ) => {
        set((state) => {
          const loop = state.layers[layerId]?.layerLoops[loopId];
          const instance = loop?.loopInstances[instanceId];
          if (!loop || !instance) return state;
          if (loop.definition.spanBeats == null) return state;
          // Start stays fixed; end moves, so it becomes the new window ceiling.
          const fitted = fitRepeatCountToWindow(
            {
              startBeat: instance.startBeat,
              repeatCount: instance.repeatCount,
            },
            endBeat,
            loop.definition,
            compositionDims.beatsPerMeasure,
          );
          if (!fitted) return state;
          return {
            layers: updateInstanceInLayers(
              state.layers,
              layerId,
              loopId,
              instanceId,
              { repeatCount: fitted.repeatCount, endBeat: fitted.endBeat },
            ),
          };
        });
        syncTimelineLoop(layerId, loopId);
      },

      shiftLoopInstanceStartBeat: (
        layerId,
        loopId,
        instanceId,
        newStartBeat,
      ) => {
        set((state) => {
          const loop = state.layers[layerId]?.layerLoops[loopId];
          const instance = loop?.loopInstances[instanceId];
          if (instance.endBeat == null) return state;

          const roundedStartBeat = Math.round(newStartBeat);
          const delta = roundedStartBeat - instance.startBeat;
          if (delta === 0) return state;

          return {
            layers: updateInstanceInLayers(
              state.layers,
              layerId,
              loopId,
              instanceId,
              {
                startBeat: instance.startBeat + delta,
                endBeat: instance.endBeat + delta,
              },
            ),
          };
        });
        syncTimelineLoop(layerId, loopId);
      },

      addNewLoop: (layerId) => {
        const layer = get().layers[layerId];
        const newLoopId: LayerLoopId = layer.layerLoops.length;

        const newLoop: LayerLoop = {
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
          loopInstances: [],
        };

        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: [...state.layers[layerId].layerLoops, newLoop],
            },
          },
        }));

        const editor = useLayerEditorStore.getState();
        editor.armNewLoopRecording(layerId, newLoopId);
        syncTimelineLoop(layerId, newLoopId);
      },

      deleteLoop: (layerId, loopId) => {
        const layer = get().layers[layerId];
        if (!layer.layerLoops[loopId]) return;
        const editor = useLayerEditorStore.getState();
        if (
          editor.selectedLayerId === layerId &&
          editor.selectedLoopId === loopId
        ) {
          useLayerEditorStore.setState({
            selectedLoopId: null,
            selectedInstanceId: null,
          });
        }
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: state.layers[layerId].layerLoops.filter(
                (_, i) => i !== loopId,
              ),
            },
          },
        }));
        syncTimelineLoop(layerId, loopId);
      },

      duplicateLoop: (layerId, loopId) => {
        const layer = get().layers[layerId];
        const source = layer?.layerLoops[loopId];
        if (!source) return;
        const newLoop: LayerLoop = {
          ...source,
          loopInstances: [],
        };
        const newLoopId = layer.layerLoops.length;
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: [...state.layers[layerId].layerLoops, newLoop],
            },
          },
        }));
        syncTimelineLoop(layerId, newLoopId);
      },

      clearLoopInstances: (layerId, loopId) => {
        const loop = get().layers[layerId]?.layerLoops[loopId];
        if (!loop) return;
        const editor = useLayerEditorStore.getState();
        if (
          editor.selectedLayerId === layerId &&
          editor.selectedLoopId === loopId
        ) {
          useLayerEditorStore.setState({ selectedInstanceId: null });
        }
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: state.layers[layerId].layerLoops.map((l, i) =>
                i !== loopId ? l : { ...loop, loopInstances: [] },
              ),
            },
          },
        }));
        syncTimelineLoop(layerId, loopId);
      },

      addLoopNote: (layerId, loopId, pitchClass, octave, absoluteStartBeat) => {
        const snappedAbsoluteStartBeat =
          snapStartBeatNearNextBoundary(absoluteStartBeat);
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];

          const hasInstance = loop.loopInstances.length > 0;
          const anchor = hasInstance
            ? loop.loopInstances[0].startBeat
            : Math.floor(snappedAbsoluteStartBeat);
          const rel = snappedAbsoluteStartBeat - anchor;
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
                layerLoops: layer.layerLoops.map((l, i) =>
                  i !== loopId
                    ? l
                    : {
                        ...loop,
                        loopInstances: hasInstance
                          ? loop.loopInstances
                          : [
                              {
                                startBeat: anchor,
                                repeatCount: null,
                                endBeat: null,
                              },
                            ],
                        definition: {
                          ...loop.definition,
                          notes: [...loop.definition.notes, newNote],
                        },
                      },
                ),
              },
            },
          };
        });
        const loopAfter =
          useLayerStore.getState().layers[layerId].layerLoops[loopId];
        loopTimeline.appendRecordingNote(
          layerId,
          loopId,
          loopAfter.definition.notes.length - 1,
          snappedAbsoluteStartBeat,
        );
      },

      endLoopNote: (layerId, loopId, absoluteEndBeat) => {
        const snappedAbsoluteEndBeat = snapEndBeatNearBoundary(absoluteEndBeat);
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
            snappedAbsoluteEndBeat,
          );
          const nextNotes = notes.slice(0, lastIdxInner);
          nextNotes.push({ ...last, lengthInBeat });

          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                layerLoops: layer.layerLoops.map((l, i) =>
                  i !== loopId
                    ? l
                    : {
                        ...loop,
                        definition: { ...loop.definition, notes: nextNotes },
                      },
                ),
              },
            },
          };
        });

        loopTimeline.patchRecordingNoteEnd(
          layerId,
          loopId,
          snappedAbsoluteEndBeat,
        );
      },

      finalizeLoop: (layerId, loopId, endBeat) => {
        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];
          if (!loop) return state;

          if (loop.loopInstances.length === 0) {
            return {
              layers: {
                ...state.layers,
                [layerId]: {
                  ...layer,
                  layerLoops: layer.layerLoops.filter((_, i) => i !== loopId),
                },
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

          const nextInstances = loop.loopInstances.map((instance) => ({
            ...instance,
            endBeat: instance.startBeat + spanBeats,
          }));
          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                layerLoops: layer.layerLoops.map((l, i) =>
                  i !== loopId
                    ? l
                    : {
                        ...loop,
                        definition: { ...loop.definition, notes, spanBeats },
                        loopInstances: nextInstances,
                      },
                ),
              },
            },
          };
        });
        syncTimelineLoop(layerId, loopId);
      },
      trimInstancesToComposition: (compositionDims) => {
        set((state) => {
          const nextLayers: LayerStoreState["layers"] = { ...state.layers };
          (Object.keys(nextLayers) as LayerId[]).forEach((layerId) => {
            const layer = nextLayers[layerId];
            let changedLayer = false;
            const nextLoops = layer.layerLoops.map((loop) => {
              if (
                loop.definition.spanBeats == null ||
                loop.loopInstances.length === 0
              ) {
                return loop;
              }
              const lastPlayable = findLastPlayableInstanceForCompositionEnd(
                loop.loopInstances,
                loop.definition,
                compositionDims,
              );
              if (lastPlayable == null) {
                changedLayer = true;
                return { ...loop, loopInstances: [] };
              }
              const truncated = loop.loopInstances
                .slice(0, lastPlayable.lastPlayableIndex + 1)
                .map((inst, idx, arr) =>
                  idx === arr.length - 1
                    ? {
                        ...inst,
                        repeatCount: lastPlayable.repeatCountAtLastPlayable,
                        endBeat: lastPlayable.endBeatAtLastPlayable,
                      }
                    : inst,
                );
              if (truncated.length === loop.loopInstances.length) return loop;
              changedLayer = true;
              return { ...loop, loopInstances: truncated };
            });
            if (changedLayer) {
              nextLayers[layerId] = { ...layer, layerLoops: nextLoops };
            }
          });
          return { layers: nextLayers };
        });
        loopTimeline.rebuildAll(useLayerStore.getState().layers);
      },

      expandInstancesToComposition: (compositionDims) => {
        set((state) => {
          const nextLayers: LayerStoreState["layers"] = { ...state.layers };
          (Object.keys(nextLayers) as LayerId[]).forEach((layerId) => {
            const layer = nextLayers[layerId];
            let changedLayer = false;
            const nextLoops = layer.layerLoops.map((loop) => {
              if (
                loop.definition.spanBeats == null ||
                loop.loopInstances.length === 0
              ) {
                return loop;
              }
              const expanded = getExpandedRepeatInfoForLastInstance(
                loop.loopInstances,
                loop.definition,
                compositionDims,
              );
              if (!expanded) return loop;
              const lastIdx = loop.loopInstances.length - 1;
              const last = loop.loopInstances[lastIdx];
              if (last.repeatCount == null || last.endBeat === expanded)
                return loop;
              const nextInstances = loop.loopInstances.map((inst, idx) =>
                idx !== lastIdx
                  ? inst
                  : {
                      ...inst,
                      endBeat: expanded,
                    },
              );
              changedLayer = true;
              return { ...loop, loopInstances: nextInstances };
            });
            if (changedLayer) {
              nextLayers[layerId] = { ...layer, layerLoops: nextLoops };
            }
          });
          return { layers: nextLayers };
        });
        loopTimeline.rebuildAll(useLayerStore.getState().layers);
      },
    }),
    {
      name: LAYER_STORE_KEY,
      version: 5,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ layers: state.layers }),
      migrate: () => ({ layers: DEFAULT_LAYERS }),
    },
  ),
);

function syncTimelineLoop(layerId: LayerId, loopId: LayerLoopId): void {
  loopTimeline.rebuildLoop(layerId, loopId, useLayerStore.getState().layers);
  audioEngine.invalidateLoop(layerId, loopId);
}
