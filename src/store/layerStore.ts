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
import { partEngine } from "../audio/partEngine";
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

      setLayerSoundId: (id, soundId) => {
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
        }));
      },

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
      },

      addLoopInstance: (
        layerId,
        loopId,
        startBeat,
        compositionDims,
        referenceInstanceId,
      ) => {
        useLayerEditorStore.setState({ selectedInstanceId: null });
        const layer = get().layers[layerId];
        const loop = layer?.layerLoops[loopId];
        if (!loop || loop.definition.spanBeats == null) return;
        const source =
          referenceInstanceId == null
            ? null
            : (loop.loopInstances[referenceInstanceId] ?? null);
        const placement = getValidInstanceInfoForProposedStart(
          loop.loopInstances,
          {
            startBeat,
            repeatCount: source?.repeatCount ?? null,
            endBeat: source?.endBeat ?? null,
          },
          loop.definition,
          compositionDims,
        );
        if (!placement) return;
        const newInstance: LayerLoopInstance = {
          startBeat,
          repeatCount: placement.repeatCount,
          endBeat: placement.endBeat,
        };
        const nextInstances = [
          ...loop.loopInstances.slice(0, placement.insertIndex),
          newInstance,
          ...loop.loopInstances.slice(placement.insertIndex),
        ];
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: state.layers[layerId].layerLoops.map((l, i) =>
                i !== loopId ? l : { ...loop, loopInstances: nextInstances },
              ),
            },
          },
        }));
        syncAddInstance(layerId, loopId, placement.insertIndex, loop.definition, newInstance);
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
        syncDeleteInstance(layerId, loopId, instanceId);
      },

      setLoopSoundId: (layerId, loopId, soundId) => {
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
        }));
        syncTimelineLoop(layerId, loopId);
      },

      setLoopKnobValue: (layerId, loopId, effect, value) => {
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
        }));
        syncTimelineLoop(layerId, loopId);
      },

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
              layerLoops: state.layers[layerId].layerLoops.map((l, i) =>
                i !== loopId
                  ? l
                  : { ...l, definition: { ...l.definition, notes } },
              ),
            },
          },
        }));
        syncLoopDefinitionNotes(layerId, loopId);
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
        const loop = get().layers[layerId]?.layerLoops[loopId];
        const instance = loop?.loopInstances[instanceId];
        if (!loop || !instance || loop.definition.spanBeats == null) return;
        const maxEndBeat = instance.endBeat ?? compositionDims.compositionEndBeat;
        const fitted = fitRepeatCountToWindow(
          { startBeat, repeatCount: instance.repeatCount },
          maxEndBeat,
          loop.definition,
          compositionDims.beatsPerMeasure,
        );
        if (!fitted) return;
        const newInstance: LayerLoopInstance = { startBeat, repeatCount: fitted.repeatCount, endBeat: fitted.endBeat };
        set((state) => ({
          layers: updateInstanceInLayers(state.layers, layerId, loopId, instanceId, {
            startBeat,
            repeatCount: fitted.repeatCount,
            endBeat: fitted.endBeat,
          }),
        }));
        syncRebuildInstance(layerId, loopId, instanceId, newInstance);
      },

      setLoopInstanceEndBeat: (
        layerId,
        loopId,
        instanceId,
        endBeat,
        compositionDims,
      ) => {
        const loop = get().layers[layerId]?.layerLoops[loopId];
        const instance = loop?.loopInstances[instanceId];
        if (!loop || !instance || loop.definition.spanBeats == null) return;
        const fitted = fitRepeatCountToWindow(
          { startBeat: instance.startBeat, repeatCount: instance.repeatCount },
          endBeat,
          loop.definition,
          compositionDims.beatsPerMeasure,
        );
        if (!fitted) return;
        const newInstance: LayerLoopInstance = { startBeat: instance.startBeat, repeatCount: fitted.repeatCount, endBeat: fitted.endBeat };
        set((state) => ({
          layers: updateInstanceInLayers(state.layers, layerId, loopId, instanceId, {
            repeatCount: fitted.repeatCount,
            endBeat: fitted.endBeat,
          }),
        }));
        syncRebuildInstance(layerId, loopId, instanceId, newInstance);
      },

      shiftLoopInstanceStartBeat: (
        layerId,
        loopId,
        instanceId,
        newStartBeat,
      ) => {
        const loop = get().layers[layerId]?.layerLoops[loopId];
        const instance = loop?.loopInstances[instanceId];
        if (!instance || instance.endBeat == null) return;
        const delta = Math.round(newStartBeat) - instance.startBeat;
        if (delta === 0) return;
        const endBeat = instance.endBeat;
        const newInstance: LayerLoopInstance = {
          startBeat: instance.startBeat + delta,
          endBeat: endBeat + delta,
          repeatCount: instance.repeatCount,
        };
        set((state) => ({
          layers: updateInstanceInLayers(state.layers, layerId, loopId, instanceId, {
            startBeat: instance.startBeat + delta,
            endBeat: endBeat + delta,
          }),
        }));
        syncRebuildInstance(layerId, loopId, instanceId, newInstance);
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
        syncClearLoop(layerId, loopId);
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
        loopTimeline.rebuildLoop(layerId, newLoopId, useLayerStore.getState().layers);
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
        syncDeleteLoop(layerId, loopId);
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
            velocity: 1,
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
        const preFinalizeLoop = useLayerStore.getState().layers[layerId].layerLoops[loopId];
        if (!preFinalizeLoop) return;

        if (preFinalizeLoop.loopInstances.length === 0) {
          set((state) => {
            const layer = state.layers[layerId];
            return {
              layers: {
                ...state.layers,
                [layerId]: {
                  ...layer,
                  layerLoops: layer.layerLoops.filter((_, i) => i !== loopId),
                },
              },
            };
          });
          syncDeleteLoop(layerId, loopId);
          return;
        }

        const inst0Start = preFinalizeLoop.loopInstances[0].startBeat;

        set((state) => {
          const layer = state.layers[layerId];
          const loop = layer.layerLoops[loopId];
          if (!loop) return state;

          const notes = [...loop.definition.notes];
          const lastIdx = notes.length - 1;
          let lastNote = notes[lastIdx];

          if (lastNote.lengthInBeat == null) {
            lastNote = {
              ...lastNote,
              lengthInBeat: lengthInBeatFromAbsoluteEnd(inst0Start, lastNote, endBeat),
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
                    : { ...loop, definition: { ...loop.definition, notes, spanBeats }, loopInstances: nextInstances },
                ),
              },
            },
          };
        });

        const updatedLoop = useLayerStore.getState().layers[layerId].layerLoops[loopId];
        syncAddInstance(
          layerId,
          loopId,
          0,
          updatedLoop.definition,
          updatedLoop.loopInstances[0],
        );
      },
      trimInstancesToComposition: (compositionDims) => {
        const currentLayers = useLayerStore.getState().layers;
        const clearedLoops: Array<{ layerId: LayerId; loopId: number }> = [];
        const removedInstanceIds: Array<{ layerId: LayerId; loopId: number; instanceId: number }> = [];
        const rebuiltLast: Array<{ layerId: LayerId; loopId: number; instanceId: number; instance: LayerLoopInstance }> = [];

        const nextLayers: LayerStoreState["layers"] = { ...currentLayers };
        let anyChanged = false;

        (Object.keys(currentLayers) as LayerId[]).forEach((layerId) => {
          const layer = currentLayers[layerId];
          let changedLayer = false;
          const nextLoops = layer.layerLoops.map((loop, loopId) => {
            if (loop.definition.spanBeats == null || loop.loopInstances.length === 0) return loop;
            const lastPlayable = findLastPlayableInstanceForCompositionEnd(
              loop.loopInstances,
              loop.definition,
              compositionDims,
            );
            if (lastPlayable == null) {
              changedLayer = true;
              clearedLoops.push({ layerId, loopId });
              return { ...loop, loopInstances: [] };
            }
            const truncated = loop.loopInstances
              .slice(0, lastPlayable.lastPlayableIndex + 1)
              .map((inst, idx, arr) =>
                idx === arr.length - 1
                  ? { ...inst, repeatCount: lastPlayable.repeatCountAtLastPlayable, endBeat: lastPlayable.endBeatAtLastPlayable }
                  : inst,
              );
            if (truncated.length === loop.loopInstances.length) return loop;
            changedLayer = true;
            loop.loopInstances.slice(truncated.length).forEach((_, idx) => {
              removedInstanceIds.push({
                layerId,
                loopId,
                instanceId: truncated.length + idx,
              });
            });
            rebuiltLast.push({
              layerId,
              loopId,
              instanceId: truncated.length - 1,
              instance: truncated[truncated.length - 1],
            });
            return { ...loop, loopInstances: truncated };
          });
          if (changedLayer) {
            anyChanged = true;
            nextLayers[layerId] = { ...layer, layerLoops: nextLoops };
          }
        });

        if (!anyChanged) return;
        set(() => ({ layers: nextLayers }));
        const updatedLayers = useLayerStore.getState().layers;
        loopTimeline.rebuildAll(updatedLayers);
        for (const { layerId, loopId } of clearedLoops) partEngine.disposeAllForLoop(layerId, loopId);
        for (const { layerId, loopId, instanceId } of removedInstanceIds) {
          partEngine.disposeForInstance(layerId, loopId, instanceId);
        }
        for (const { layerId, loopId, instanceId, instance } of rebuiltLast) {
          const mapping = updatedLayers[layerId].layerLoops[loopId].mapping;
          partEngine.disposeForInstance(layerId, loopId, instanceId);
          partEngine.buildForInstance(
            layerId,
            loopId,
            instanceId,
            updatedLayers[layerId].layerLoops[loopId].definition,
            instance,
            mapping,
            (id, loopMapping) => audioEngine.buildPlaybackSynth(id, loopMapping),
            (synth) => audioEngine.releasePlaybackSynth(synth),
          );
        }
      },

      expandInstancesToComposition: (compositionDims) => {
        const currentLayers = useLayerStore.getState().layers;
        const rebuiltLast: Array<{ layerId: LayerId; loopId: number; instanceId: number; instance: LayerLoopInstance }> = [];

        const nextLayers: LayerStoreState["layers"] = { ...currentLayers };
        let anyChanged = false;

        (Object.keys(currentLayers) as LayerId[]).forEach((layerId) => {
          const layer = currentLayers[layerId];
          let changedLayer = false;
          const nextLoops = layer.layerLoops.map((loop, loopId) => {
            if (loop.definition.spanBeats == null || loop.loopInstances.length === 0) return loop;
            const expanded = getExpandedRepeatInfoForLastInstance(
              loop.loopInstances,
              loop.definition,
              compositionDims,
            );
            if (!expanded) return loop;
            const lastIdx = loop.loopInstances.length - 1;
            const last = loop.loopInstances[lastIdx];
            if (last.repeatCount == null || last.endBeat === expanded) return loop;
            changedLayer = true;
            const updatedLast = { ...last, endBeat: expanded };
            rebuiltLast.push({ layerId, loopId, instanceId: lastIdx, instance: updatedLast });
            return { ...loop, loopInstances: loop.loopInstances.map((inst, idx) => idx !== lastIdx ? inst : updatedLast) };
          });
          if (changedLayer) {
            anyChanged = true;
            nextLayers[layerId] = { ...layer, layerLoops: nextLoops };
          }
        });

        if (!anyChanged) return;
        set(() => ({ layers: nextLayers }));
        const updatedLayers = useLayerStore.getState().layers;
        loopTimeline.rebuildAll(updatedLayers);
        for (const { layerId, loopId, instanceId, instance } of rebuiltLast) {
          const mapping = updatedLayers[layerId].layerLoops[loopId].mapping;
          partEngine.disposeForInstance(layerId, loopId, instanceId);
          partEngine.buildForInstance(
            layerId,
            loopId,
            instanceId,
            updatedLayers[layerId].layerLoops[loopId].definition,
            instance,
            mapping,
            (id, loopMapping) => audioEngine.buildPlaybackSynth(id, loopMapping),
            (synth) => audioEngine.releasePlaybackSynth(synth),
          );
        }
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

/** Full Part rebuild for a loop — use when note content, repeat stride, or all instance bounds changed. */
function syncTimelineLoop(layerId: LayerId, loopId: LayerLoopId): void {
  const layers = useLayerStore.getState().layers;
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  partEngine.rebuildAllForLoop(
    layerId,
    loopId,
    layers[layerId].layerLoops[loopId],
    (id, mapping) => audioEngine.buildPlaybackSynth(id, mapping),
    (synth) => audioEngine.releasePlaybackSynth(synth),
  );
}

/** Build one new Part for a freshly added instance (no prior Part to dispose). */
function syncAddInstance(
  layerId: LayerId,
  loopId: LayerLoopId,
  instanceId: number,
  definition: LoopDefinition,
  instance: LayerLoopInstance,
): void {
  const layers = useLayerStore.getState().layers;
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  partEngine.buildForInstance(
    layerId,
    loopId,
    instanceId,
    definition,
    instance,
    layers[layerId].layerLoops[loopId].mapping,
    (id, mapping) => audioEngine.buildPlaybackSynth(id, mapping),
    (synth) => audioEngine.releasePlaybackSynth(synth),
  );
}

/** Rebuild the Part for one updated instance id. */
function syncRebuildInstance(
  layerId: LayerId,
  loopId: LayerLoopId,
  instanceId: number,
  instance: LayerLoopInstance,
): void {
  const layers = useLayerStore.getState().layers;
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  partEngine.disposeForInstance(layerId, loopId, instanceId);
  partEngine.buildForInstance(
    layerId,
    loopId,
    instanceId,
    layers[layerId].layerLoops[loopId].definition,
    instance,
    layers[layerId].layerLoops[loopId].mapping,
    (id, mapping) => audioEngine.buildPlaybackSynth(id, mapping),
    (synth) => audioEngine.releasePlaybackSynth(synth),
  );
}

/** Dispose the Part for one deleted instance. */
function syncDeleteInstance(
  layerId: LayerId,
  loopId: LayerLoopId,
  instanceId: number,
): void {
  loopTimeline.rebuildLoop(layerId, loopId, useLayerStore.getState().layers);
  partEngine.disposeForInstance(layerId, loopId, instanceId);
}

/** Update notes for an existing loop without disposing/recreating Parts. */
function syncLoopDefinitionNotes(layerId: LayerId, loopId: LayerLoopId): void {
  const layers = useLayerStore.getState().layers;
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  const definition = layers[layerId]?.layerLoops[loopId]?.definition;
  if (!definition) return;
  partEngine.updateLoopNotesInPlace(layerId, loopId, definition);
}

/** Dispose all Parts for a loop whose instances were cleared (loop still exists in state). */
function syncClearLoop(layerId: LayerId, loopId: LayerLoopId): void {
  loopTimeline.rebuildLoop(layerId, loopId, useLayerStore.getState().layers);
  partEngine.disposeAllForLoop(layerId, loopId);
}

/** Dispose all Parts for a loop that was deleted from state (loopId no longer valid). */
function syncDeleteLoop(layerId: LayerId, loopId: LayerLoopId): void {
  loopTimeline.invalidateLoop(layerId, loopId);
  partEngine.disposeAllForLoop(layerId, loopId);
}
