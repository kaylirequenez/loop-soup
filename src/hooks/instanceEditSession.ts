/**
 * Imperative instance-edit actions (shift / trim start / trim end).
 * Used by {@link ../components/userInput/globalKeyHandler.ts} and kept next to {@link ./useInstanceEditor.ts}.
 */
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerStore } from "../store/layerStore";
import {
  repeatStrideBeats,
  normalizeInstancesForPlacement,
  areInstanceIdsConsecutive,
  getValidInstancesForProposedPlacement,
  getValidShiftRange,
  getValidStartBeatRange,
  getValidEndBeatRange,
  maxRepeatCountForEndBeat,
} from "../utils/loopInstanceUtils";
import { compositionLoopBeatLength } from "../utils/compositionState";
import { useCompositionStore } from "../store/compositionStore";
import type {
  LayerLoop,
  LayerLoopInstance,
  LoopDefinition,
} from "../types/layer";
import type { InstanceEditMode } from "../types/layerEditor";
import { isRepeatOff } from "../utils/layerState";

export function getInstanceEditCompositionDims() {
  const { meter, totalMeasures } = useCompositionStore.getState();
  return {
    beatsPerMeasure: meter.beatsPerMeasure,
    compositionEndBeat: compositionLoopBeatLength(
      totalMeasures,
      meter.beatsPerMeasure,
    ),
  };
}

/**
 * Validates shift against original non-selected instances and merges the result
 * back into the full proposedInstances array (preserving non-selected entries).
 */
function applyShiftToEditorState(
  candidateSelection: LayerLoopInstance[],
  anchorStartBeat: number,
): boolean {
  const es = useLayerEditorStore.getState();
  if (!es.instanceEditState || es.selectedLoopId == null) return false;
  const { originalInstancesSansSelection, sortedIds, proposedInstances } =
    es.instanceEditState;
  const loop =
    useLayerStore.getState().layers[es.selectedLayerId]?.layerLoops[
      es.selectedLoopId
    ];
  if (!loop || loop.definition.spanBeats == null) return false;

  const compositionDims = getInstanceEditCompositionDims();
  const placement = getValidInstancesForProposedPlacement(
    originalInstancesSansSelection,
    candidateSelection,
    anchorStartBeat,
    loop.definition,
    compositionDims,
  );
  if (placement.proposedInstances.length !== candidateSelection.length)
    return false;

  // Merge placed instances back into full array; non-selected stay unchanged.
  // sortedIds[i] is the original array index for placement.proposedInstances[i].
  const next = proposedInstances.map((inst, i) => {
    const pos = sortedIds.indexOf(i);
    return pos === -1 ? inst : placement.proposedInstances[pos];
  });
  es.updateProposedInstances(next);
  return true;
}

export function applyShiftNudge(direction: 1 | -1): void {
  const es = useLayerEditorStore.getState();
  if (!es.instanceEditState) return;
  const { sortedIds, proposedInstances } = es.instanceEditState;
  if (sortedIds.length === 0) return;

  const ls = useLayerStore.getState();
  const loop = ls.layers[es.selectedLayerId]?.layerLoops[es.selectedLoopId!];
  if (!loop || loop.definition.spanBeats == null) return;

  const compositionDims = getInstanceEditCompositionDims();
  const { minFirstStart, maxFirstStart } = getValidShiftRange(
    proposedInstances,
    sortedIds,
    loop.definition,
    compositionDims,
  );
  const newFirstStart = proposedInstances[sortedIds[0]].startBeat + direction;
  if (newFirstStart < minFirstStart || newFirstStart > maxFirstStart) return;

  const selected = sortedIds.map((id) => proposedInstances[id]);
  const shifted = selected.map((inst) => ({
    ...inst,
    startBeat: inst.startBeat + direction,
    endBeat: inst.endBeat != null ? inst.endBeat + direction : null,
  }));
  applyShiftToEditorState(shifted, shifted[0].startBeat);
}

export function applyStartNudge(direction: 1 | -1): void {
  const es = useLayerEditorStore.getState();
  if (!es.instanceEditState) return;
  const { sortedIds, proposedInstances } = es.instanceEditState;
  const idx = sortedIds[0];
  const ls = useLayerStore.getState();
  const loop = ls.layers[es.selectedLayerId]?.layerLoops[es.selectedLoopId!];
  if (!loop || loop.definition.spanBeats == null) return;

  const { beatsPerMeasure } = getInstanceEditCompositionDims();
  const stride = repeatStrideBeats(loop.definition, beatsPerMeasure);
  const spanBeats = loop.definition.spanBeats;
  const step = stride > 0 ? stride : spanBeats;
  const inst = proposedInstances[idx];
  const newStart = inst.startBeat + direction * step;

  const { min, max } = getValidStartBeatRange(proposedInstances, idx, loop.definition);
  if (newStart < min || newStart > max) return;

  // Keep endBeat fixed; recalculate repeatCount to fit. Null repeatCount stays null.
  const newRepeatCount =
    inst.repeatCount !== null
      ? Math.max(0, Math.round((inst.endBeat! - newStart - spanBeats) / stride))
      : null;

  es.updateProposedInstances(
    proposedInstances.map((inst2, i) =>
      i !== idx ? inst2 : { ...inst2, startBeat: newStart, repeatCount: newRepeatCount },
    ),
  );
}

function nextEndBeat(
  inst: LayerLoopInstance,
  direction: 1 | -1,
  definition: LoopDefinition,
  beatsPerMeasure: number,
): LayerLoopInstance {
  const spanBeats = definition.spanBeats!;
  const stride = repeatStrideBeats(definition, beatsPerMeasure);
  const endBeat = inst.endBeat! + direction * stride;
  const nextRepeatCount = maxRepeatCountForEndBeat(
    inst.startBeat,
    spanBeats,
    stride,
    endBeat,
  );
  return { ...inst, repeatCount: nextRepeatCount, endBeat };
}

export function applyEndNudge(direction: 1 | -1): void {
  const es = useLayerEditorStore.getState();
  if (!es.instanceEditState) return;
  const { sortedIds, proposedInstances } = es.instanceEditState;
  const idx = sortedIds[0];
  const ls = useLayerStore.getState();
  const loop = ls.layers[es.selectedLayerId]?.layerLoops[es.selectedLoopId!];
  if (!loop || loop.definition.spanBeats == null) return;

  const compositionDims = getInstanceEditCompositionDims();
  const candidate = nextEndBeat(
    proposedInstances[idx],
    direction,
    loop.definition,
    compositionDims.beatsPerMeasure,
  );

  const { min, max } = getValidEndBeatRange(
    proposedInstances,
    idx,
    loop.definition,
    compositionDims,
  );
  if (candidate.endBeat! < min || candidate.endBeat! > max) return;

  es.updateProposedInstances(
    proposedInstances.map((inst2, i) => (i !== idx ? inst2 : candidate)),
  );
}

export function commitInstanceEdit(): void {
  const es = useLayerEditorStore.getState();
  if (!es.instanceEditState || es.selectedLoopId == null) return;
  const { proposedInstances } = es.instanceEditState;
  const ls = useLayerStore.getState();
  const loop = ls.layers[es.selectedLayerId]?.layerLoops[es.selectedLoopId];
  if (!loop || loop.definition.spanBeats == null) return;

  ls.commitInstanceEdits(
    es.selectedLayerId,
    es.selectedLoopId,
    proposedInstances,
  );
  es.cancelInstanceEdit();
}

/** Starts an edit session if selection + loop satisfy {@link canBeginInstanceEdit}. */
export function tryBeginInstanceEdit(mode: InstanceEditMode): void {
  const es = useLayerEditorStore.getState();
  if (es.selectedLoopId == null) return;
  const { selectedLayerId, selectedLoopId, selectedInstanceIds } = es;
  const sortedIds = [...selectedInstanceIds].sort((a, b) => a - b);
  const loop =
    useLayerStore.getState().layers[selectedLayerId]?.layerLoops[
      selectedLoopId
    ];
  if (!canBeginInstanceEdit(mode, selectedInstanceIds, loop)) return;
  es.beginInstanceEdit(mode, sortedIds, loop.loopInstances);
}

/**
 * Start/end trim only applies when the loop has phrase repeats enabled
 * (isRepeatOff is false and span is known).
 */
export function trimInstanceEditAllowed(definition: LoopDefinition): boolean {
  return definition.spanBeats != null && !isRepeatOff(definition);
}

/**
 * Whether an instance edit session may be opened for `mode` with the current selection.
 *
 * - **shift**: at least one instance; indices must be a consecutive block on the loop row.
 * - **start** / **end**: exactly one instance, and repeat is configured.
 */
export function canBeginInstanceEdit(
  mode: InstanceEditMode,
  instanceIds: number[],
  loop: LayerLoop,
): boolean {
  const sortedIds = [...instanceIds].sort((a, b) => a - b);
  if (mode === "shift") {
    return areInstanceIdsConsecutive(sortedIds, loop.loopInstances.length);
  }
  return sortedIds.length === 1 && trimInstanceEditAllowed(loop.definition);
}

/**
 * Arms placement mode from the current layer editor selection (same payload as ⌘/Ctrl+C).
 * Returns whether `pendingPlacement` was set.
 */
export function armCopyPlacementFromSelection(): boolean {
  const {
    selectedLayerId,
    selectedLoopId,
    selectedInstanceIds,
    setPendingPlacement,
  } = useLayerEditorStore.getState();
  if (selectedLoopId === null || selectedInstanceIds.length === 0) return false;
  const loop =
    useLayerStore.getState().layers[selectedLayerId]?.layerLoops[
      selectedLoopId
    ];
  if (!loop) return false;
  const selected = selectedInstanceIds.flatMap((id) => {
    const inst = loop.loopInstances[id];
    return inst != null ? [inst] : [];
  });
  if (selected.length === 0) return false;
  setPendingPlacement({
    layerId: selectedLayerId,
    loopId: selectedLoopId,
    instances: normalizeInstancesForPlacement(selected),
  });
  return true;
}
