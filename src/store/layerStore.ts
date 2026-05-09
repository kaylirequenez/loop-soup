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
import {
  syncAddInstances,
  syncClearLoop,
  syncDeleteInstance,
  syncDeleteLoop,
  syncExpandInstancesToComposition,
  syncLoopDefinitionNotes,
  syncLoopMapping,
  syncRebuildInstance,
  syncTimelineLoop,
  syncTrimInstancesToComposition,
} from "../audio/layerRuntimeSync";
import {
  snapStartBeatNearNextBoundary,
  snapEndBeatNearBoundary,
  findLastPlayableInstanceForCompositionEnd,
  reflowInstanceRepeatsForDefinition,
  getExpandedRepeatInfoForLastInstance,
  getValidInstancesForProposedPlacement,
  fitRepeatCountToWindow,
} from "../utils/loopInstanceUtils";

export const LAYER_STORE_KEY = "loop-soup-layers";

const initialLayers: LayerStoreState["layers"] = DEFAULT_LAYERS;

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
  const reflowed = reflowInstanceRepeatsForDefinition(
    loop.loopInstances,
    nextDefinition,
    compositionDims,
  );
  const nextLoopInstances = loop.loopInstances.map((instance, idx) => ({
    ...instance,
    repeatCount: reflowed[idx].repeatCount,
    endBeat: reflowed[idx].endBeat,
  }));
  return updateLoopInLayers(layers, layerId, loopId, {
    definition: nextDefinition,
    loopInstances: nextLoopInstances,
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
        // Sound changes on the layer default mapping don't affect existing loop
        // placements or Part scheduling; audioEngine will pick them up when
        // new synths are built for future loops/instances.
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
        // Like setLayerSoundId, this only affects the layer default mapping
        // used when creating future loops; existing loop synths are driven by
        // per-loop mappings.
      },

      /**
       * Spec: inserting one instance rebuilds `loopTimeline` for that
       * `loopId` and creates exactly one corresponding Part, leaving other
       * instances untouched.
       */
      addLoopInstance: (
        layerId,
        loopId,
        startBeat,
        compositionDims,
        reference,
      ) => {
        useLayerEditorStore.setState({ selectedInstanceIds: [] });
        const layer = get().layers[layerId];
        const loop = layer?.layerLoops[loopId];
        if (!loop || loop.definition.spanBeats == null) return;
        startBeat = Math.round(startBeat);
        const proposedInstances = reference ?? [
          { startBeat, repeatCount: null, endBeat: null },
        ];
        const { proposedInstances: placed, insertIndex } =
          getValidInstancesForProposedPlacement(
            loop.loopInstances,
            proposedInstances,
            startBeat,
            loop.definition,
            compositionDims,
          );
        if (placed.length === 0) return;
        const nextInstances = [
          ...loop.loopInstances.slice(0, insertIndex),
          ...placed,
          ...loop.loopInstances.slice(insertIndex),
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
        syncAddInstances(
          useLayerStore.getState().layers,
          layerId,
          loopId,
          placed,
        );
      },

      /**
       * Spec: deleting one instance rebuilds `loopTimeline` for that
       * `loopId` and disposes exactly one corresponding Part, leaving other
       * instances untouched.
       */
      deleteLoopInstance: (layerId, loopId, instanceId) => {
        const loop = get().layers[layerId]?.layerLoops[loopId];
        const startBeat = loop?.loopInstances[instanceId]?.startBeat;
        if (!loop || startBeat == null) return;
        useLayerEditorStore.setState({ selectedInstanceIds: [] });
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
        syncDeleteInstance(
          useLayerStore.getState().layers,
          layerId,
          loopId,
          startBeat,
        );
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
        // This changes only the audio mapping (instrument choice) for this
        // loop; note geometry and placements are unchanged, so we only need to
        // rebuild the Parts/synths for this loop.
        syncLoopMapping(useLayerStore.getState().layers, layerId, loopId);
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
        // Effects only affect the instrument envelope/FX for this loop. We can
        // keep the same instance placements and just rebuild the Parts/synths
        // for this loop.
        syncLoopMapping(useLayerStore.getState().layers, layerId, loopId);
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
        // Shifting octaves keeps note timing/placements the same; we only need
        // to update the per-Part note events (frequencies) for this loop.
        syncLoopDefinitionNotes(
          useLayerStore.getState().layers,
          layerId,
          loopId,
        );
      },

      /**
       * Spec: changing repeat stride settings changes event times and Part
       * loop bounds, so we fully rebuild timeline+Parts for this loop.
       */
      setLoopRepeatUnit: (layerId, loopId, unit, compositionDims) => {
        const { beatsPerMeasure } = compositionDims;
        set((state) => {
          const loop = state.layers[layerId]?.layerLoops[loopId];
          if (!loop) return state;
          const spanBeats = loop.definition.spanBeats;
          let nextMeasMem = loop.definition.repeatEveryMeasuresMemory;
          let nextBeatMem = loop.definition.repeatEveryBeatsMemory;
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
        syncTimelineLoop(useLayerStore.getState().layers, layerId, loopId);
      },

      /**
       * Spec: setting repeat cadence changes event times and Part loop
       * bounds, so we fully rebuild timeline+Parts for this loop.
       */
      setLoopRepeatEvery: (layerId, loopId, value, compositionDims) => {
        set((state) => {
          const loop = state.layers[layerId].layerLoops[loopId];
          const unit = loop.definition.repeatUnit;
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
        syncTimelineLoop(useLayerStore.getState().layers, layerId, loopId);
      },

      setInstanceRepeatCount: (
        layerId,
        loopId,
        instanceId,
        repeatCount,
        compositionDims,
      ) => {
        const loop = get().layers[layerId]?.layerLoops[loopId];
        const instance = loop?.loopInstances[instanceId];
        if (!loop || !instance || loop.definition.spanBeats == null) return;
        const maxEndBeat =
          repeatCount == null ? null : compositionDims.compositionEndBeat;
        const fitted = fitRepeatCountToWindow(
          { startBeat: instance.startBeat, repeatCount },
          maxEndBeat,
          loop.definition,
          compositionDims,
        );
        if (!fitted) return;
        const newInstance: LayerLoopInstance = {
          startBeat: instance.startBeat,
          repeatCount: fitted.repeatCount,
          endBeat: fitted.endBeat,
        };
        set((state) => ({
          layers: updateInstanceInLayers(
            state.layers,
            layerId,
            loopId,
            instanceId,
            { repeatCount: fitted.repeatCount, endBeat: fitted.endBeat },
          ),
        }));
        syncRebuildInstance(
          useLayerStore.getState().layers,
          layerId,
          loopId,
          instance.startBeat,
          newInstance,
        );
      },

      commitInstanceEdits: (layerId, loopId, instances) => {
        const loop = get().layers[layerId]?.layerLoops[loopId];
        if (!loop) return;
        set((state) => ({
          layers: {
            ...state.layers,
            [layerId]: {
              ...state.layers[layerId],
              layerLoops: state.layers[layerId].layerLoops.map((l, i) =>
                i !== loopId ? l : { ...l, loopInstances: instances },
              ),
            },
          },
        }));
        syncTimelineLoop(useLayerStore.getState().layers, layerId, loopId);
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

      /**
       * Spec: deleting a loop removes its `loopTimeline` expansion and
       * disposes all Parts for all its instances.
       */
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
            selectedInstanceIds: [],
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
        syncClearLoop(useLayerStore.getState().layers, layerId, loopId);
      },

      /**
       * Spec: duplicating a loop creates a new (empty) loop with the same
       * definition in state, selects it in the editor, and rebuilds the timeline entry.
       */
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
        loopTimeline.rebuildLoop(
          layerId,
          newLoopId,
          useLayerStore.getState().layers,
        );
        useLayerEditorStore.getState().selectLoop(layerId, newLoopId);
      },

      /**
       * Spec: clearing instances keeps the loop definition but disposes all
       * Parts for that loop and rebuilds the timeline expansion accordingly.
       */
      clearLoopInstances: (layerId, loopId) => {
        const loop = get().layers[layerId]?.layerLoops[loopId];
        if (!loop) return;
        const editor = useLayerEditorStore.getState();
        if (
          editor.selectedLayerId === layerId &&
          editor.selectedLoopId === loopId
        ) {
          useLayerEditorStore.setState({ selectedInstanceIds: [] });
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

      /**
       * Spec: finalizing recording sets `definition.spanBeats` and instance
       * endBeat, then builds/activates Parts for instance 0 of this loop.
       */
      finalizeLoop: (layerId, loopId, endBeat) => {
        const preFinalizeLoop =
          useLayerStore.getState().layers[layerId].layerLoops[loopId];
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

          const notes = [...loop.definition.notes];
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

        const updatedLoop =
          useLayerStore.getState().layers[layerId].layerLoops[loopId];
        syncAddInstances(useLayerStore.getState().layers, layerId, loopId, [
          updatedLoop.loopInstances[0]!,
        ]);
      },

      trimInstancesToComposition: (compositionDims) => {
        /**
         * Specification:
         * - If an instance cannot be fully played in the new composition window,
         *   drop it.
         * - Keep all instances up to (and including) the last playable instance.
         * - For that last kept instance, clamp `repeatCount` + `endBeat` so the loop
         *   fits within `compositionDims.compositionEndBeat`.
         *
         * Side effects:
         * - Rebuild only affected `loopTimeline` entries.
         * - Dispose parts for removed instances and rebuild only the final kept
         *   instance's Part.
         */
        const currentLayers = useLayerStore.getState().layers;
        const clearedLoops: Array<{ layerId: LayerId; loopId: number }> = [];
        const removedInstanceBeats: Array<{
          layerId: LayerId;
          loopId: number;
          startBeat: number;
        }> = [];
        const rebuiltLast: Array<{
          layerId: LayerId;
          loopId: number;
          instance: LayerLoopInstance;
        }> = [];
        const affectedTimelineLoops = new Set<string>();

        const nextLayers: LayerStoreState["layers"] = { ...currentLayers };
        let anyChanged = false;

        (Object.keys(currentLayers) as LayerId[]).forEach((layerId) => {
          const layer = currentLayers[layerId];
          let changedLayer = false;
          const nextLoops = layer.layerLoops.map((loop, loopId) => {
            if (
              loop.definition.spanBeats == null ||
              loop.loopInstances.length === 0
            )
              return loop;
            const lastPlayable = findLastPlayableInstanceForCompositionEnd(
              loop.loopInstances,
              loop.definition,
              compositionDims,
            );
            if (lastPlayable == null) {
              changedLayer = true;
              anyChanged = true;
              affectedTimelineLoops.add(`${layerId}:${loopId}`);
              clearedLoops.push({ layerId, loopId });
              return { ...loop, loopInstances: [] };
            }
            const keptCount = lastPlayable.lastPlayableIndex + 1;
            const truncated = loop.loopInstances
              .slice(0, keptCount)
              .map((inst, idx) => {
                if (idx !== keptCount - 1) return inst;
                return {
                  ...inst,
                  repeatCount: lastPlayable.repeatCountAtLastPlayable,
                  endBeat: lastPlayable.endBeatAtLastPlayable,
                };
              });
            const changedKeptInstances = truncated
              .map((nextInstance, instanceId) => {
                const prevInstance = loop.loopInstances[instanceId];
                if (
                  prevInstance.repeatCount === nextInstance.repeatCount &&
                  prevInstance.endBeat === nextInstance.endBeat
                ) {
                  return null;
                }
                return {
                  instanceId,
                  previous: {
                    repeatCount: prevInstance.repeatCount,
                    endBeat: prevInstance.endBeat,
                  },
                  next: {
                    repeatCount: nextInstance.repeatCount,
                    endBeat: nextInstance.endBeat,
                  },
                };
              })
              .filter((entry) => entry != null);
            const removedAny = truncated.length < loop.loopInstances.length;
            const changedAnyKept = changedKeptInstances.length > 0;
            if (!removedAny && !changedAnyKept) return loop;

            changedLayer = true;
            anyChanged = true;
            affectedTimelineLoops.add(`${layerId}:${loopId}`);

            for (let i = truncated.length; i < loop.loopInstances.length; i++) {
              removedInstanceBeats.push({
                layerId,
                loopId,
                startBeat: loop.loopInstances[i]!.startBeat,
              });
            }
            rebuiltLast.push({
              layerId,
              loopId,
              instance: truncated[truncated.length - 1]!,
            });
            return { ...loop, loopInstances: truncated };
          });
          if (changedLayer) {
            nextLayers[layerId] = { ...layer, layerLoops: nextLoops };
          }
        });

        if (!anyChanged) return;
        set(() => ({ layers: nextLayers }));
        const updatedLayers = useLayerStore.getState().layers;
        syncTrimInstancesToComposition({
          layers: updatedLayers,
          affectedTimelineLoops,
          clearedLoops,
          removedInstanceBeats,
          rebuiltLast,
        });
      },

      expandInstancesToComposition: (compositionDims) => {
        /**
         * Specification:
         * - When the composition end beat changes, only the last instance of each loop
         *   can potentially move.
         * - If the last instance is open-ended (`repeatCount === null`), expand (clamp)
         *   its `endBeat` to the latest end that still fits inside
         *   `compositionDims.compositionEndBeat`.
         * - Do not touch any other instances.
         *
         * Side effects:
         * - Rebuild only affected `loopTimeline` entries.
         * - Dispose/rebuild only the last open-ended instance's Part (if its end
         *   beat actually changed).
         */
        const currentLayers = useLayerStore.getState().layers;
        const rebuiltLast: Array<{
          layerId: LayerId;
          loopId: number;
          instance: LayerLoopInstance;
        }> = [];
        const affectedTimelineLoops = new Set<string>();

        const nextLayers: LayerStoreState["layers"] = { ...currentLayers };
        let anyChanged = false;

        (Object.keys(currentLayers) as LayerId[]).forEach((layerId) => {
          const layer = currentLayers[layerId];
          let changedLayer = false;
          const nextLoops = layer.layerLoops.map((loop, loopId) => {
            if (
              loop.definition.spanBeats == null ||
              loop.loopInstances.length === 0
            )
              return loop;
            const expandedEndBeat = getExpandedRepeatInfoForLastInstance(
              loop.loopInstances,
              loop.definition,
              compositionDims,
            );
            if (expandedEndBeat == null) return loop;
            const lastIdx = loop.loopInstances.length - 1;
            const last = loop.loopInstances[lastIdx];

            // Only open-ended instances should be expanded.
            if (last.repeatCount != null) return loop;
            if (last.endBeat === expandedEndBeat) return loop;

            changedLayer = true;
            anyChanged = true;
            affectedTimelineLoops.add(`${layerId}:${loopId}`);
            const updatedLast = { ...last, endBeat: expandedEndBeat };
            rebuiltLast.push({
              layerId,
              loopId,
              instance: updatedLast,
            });
            return {
              ...loop,
              loopInstances: loop.loopInstances.map((inst, idx) =>
                idx !== lastIdx ? inst : updatedLast,
              ),
            };
          });
          if (changedLayer) {
            nextLayers[layerId] = { ...layer, layerLoops: nextLoops };
          }
        });

        if (!anyChanged) return;
        set(() => ({ layers: nextLayers }));
        const updatedLayers = useLayerStore.getState().layers;
        syncExpandInstancesToComposition({
          layers: updatedLayers,
          affectedTimelineLoops,
          rebuiltLast,
        });
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
