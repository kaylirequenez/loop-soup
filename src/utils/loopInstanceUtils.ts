import type { LayerLoopInstance, LoopDefinition } from "../types/layer";
import { getRepeatEveryForUnit, isRepeatOff } from "./layerState";

const LOOP_NOTE_SNAP_TO_BOUNDARY_EPSILON = 0.03;

/** Timeline length + meter numerator; callers read from composition state / store as needed. */
export interface LoopInstanceCompositionDims {
  compositionEndBeat: number;
  beatsPerMeasure: number;
}

export function snapStartBeatNearNextBoundary(absoluteBeat: number): number {
  const floorBeat = Math.floor(absoluteBeat);
  const inBeat = absoluteBeat - floorBeat;
  if (inBeat > 0 && 1 - inBeat <= LOOP_NOTE_SNAP_TO_BOUNDARY_EPSILON) {
    return floorBeat + 1;
  }
  return absoluteBeat;
}

export function snapEndBeatNearBoundary(absoluteBeat: number): number {
  const floorBeat = Math.floor(absoluteBeat);
  const inBeat = absoluteBeat - floorBeat;
  if (inBeat > 0 && inBeat <= LOOP_NOTE_SNAP_TO_BOUNDARY_EPSILON) {
    return floorBeat;
  }
  return absoluteBeat;
}

export interface InstanceSpan {
  startBeat: number;
  endBeat: number;
}

/** Beats between consecutive phrase starts for this definition, or null if repeat grid is off. */
export function repeatStrideBeats(
  definition: LoopDefinition,
  beatsPerMeasure: number,
): number {
  const repeatEvery = getRepeatEveryForUnit(definition.repeatUnit, definition);
  if (repeatEvery == null) return 0;
  return definition.repeatUnit === "beats"
    ? repeatEvery
    : repeatEvery * beatsPerMeasure;
}

/** Largest repeat count that still fits before `maxEndBeat` (exclusive), for step > 0. */
export function maxRepeatCountForEndBeat(
  instanceStartBeat: number,
  spanBeats: number,
  step: number,
  maxEndBeat: number,
): number {
  return Math.max(
    0,
    Math.floor((maxEndBeat - instanceStartBeat - spanBeats + 1e-6) / step),
  );
}

function lowerBoundByEndBeat(spans: InstanceSpan[], beat: number): number {
  let lo = 0;
  let hi = spans.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (spans[mid].endBeat <= beat) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

interface PlacementSearchResult {
  insertIndex: number;
  overlapsExisting: boolean;
}

/**
 * Single binary-search placement lookup.
 * `insertIndex` is the first span whose endBeat exceeds `beat`.
 * If that span starts at/before beat, then `beat` is inside it.
 */
function searchPlacementAtBeat(
  spans: InstanceSpan[],
  beat: number,
): PlacementSearchResult {
  const insertIndex = lowerBoundByEndBeat(spans, beat);
  const overlapsExisting =
    insertIndex < spans.length && spans[insertIndex].startBeat <= beat;
  return { insertIndex, overlapsExisting };
}

/** Returns spans from finalized instance cache (startBeat/endBeat). */
export function loopInstanceSpans(
  instances: LayerLoopInstance[],
): InstanceSpan[] {
  return instances.flatMap((instance) =>
    instance.endBeat == null
      ? []
      : [
          {
            startBeat: instance.startBeat,
            endBeat: Math.ceil(instance.endBeat!),
          },
        ],
  );
}

/**
 * Binary search for the instance index that contains a note with the given base start beat
 * (absoluteStartBeat - repeatOffsetBeats). Assumes instances are sorted by startBeat.
 */
export function findInstanceIndex(
  baseStartBeat: number,
  instances: LayerLoopInstance[],
): number {
  let lo = 0;
  let hi = instances.length - 1;
  let result = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (instances[mid].startBeat <= baseStartBeat) {
      result = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return result;
}

/** Shifts instances so the earliest startBeat === 0. */
export function normalizeInstancesForPlacement(
  instances: LayerLoopInstance[],
): LayerLoopInstance[] {
  const sorted = [...instances].sort((a, b) => a.startBeat - b.startBeat);
  const offset = sorted[0]!.startBeat;
  if (offset === 0) return sorted;
  return sorted.map((inst) => ({
    ...inst,
    startBeat: inst.startBeat - offset,
    endBeat: inst.endBeat != null ? inst.endBeat - offset : null,
  }));
}

export interface ValidInstanceInfo {
  repeatCount: number | null;
  endBeat: number;
}

export interface RepeatCountFitResult extends ValidInstanceInfo {}

export interface MultiPlacementResult {
  proposedInstances: LayerLoopInstance[];
  insertIndex: number;
}

/**
 * Iterates backwards through `instances` to find the last one that fits
 * before `nextBlockingBeat` (or composition end when null) and returns its
 * fitted index + repeatCount + endBeat, or null if none fit.
 */
function findLastFittableInstance(
  instances: LayerLoopInstance[],
  nextBlockingBeat: number | null,
  definition: LoopDefinition,
  compositionDims: LoopInstanceCompositionDims,
): { index: number; repeatCount: number | null; endBeat: number } | null {
  for (let i = instances.length - 1; i >= 0; i--) {
    const inst = instances[i];
    const maxEndBeat =
      inst.repeatCount == null && nextBlockingBeat == null
        ? null
        : Math.min(nextBlockingBeat ?? Infinity, inst.endBeat ?? Infinity);
    const fitted = fitRepeatCountToWindow(
      inst,
      maxEndBeat,
      definition,
      compositionDims,
    );
    if (fitted) return { index: i, ...fitted };
  }
  return null;
}

/**
 * Places `proposedInstances` starting at `proposedStartBeat`, fitting them
 * against `existingInstances` and the composition window.
 *
 * - Sorts and shifts all proposed instances so the first starts at `proposedStartBeat`.
 * - Returns an empty list if the start overlaps an existing instance.
 * - Drops proposed instances that start at or after the next existing instance (or composition end).
 * - Fits the last remaining instance's repeatCount/endBeat; if it can't fit,
 *   drops it and tries the one before, until the list is empty.
 */
export function getValidInstancesForProposedPlacement(
  existingInstances: LayerLoopInstance[],
  proposedInstances: LayerLoopInstance[],
  proposedStartBeat: number,
  definition: LoopDefinition,
  compositionDims: LoopInstanceCompositionDims,
): MultiPlacementResult {
  const sorted = [...proposedInstances].sort(
    (a, b) => a.startBeat - b.startBeat,
  );
  const delta = proposedStartBeat - sorted[0].startBeat;
  const shifted = sorted.map((inst) => ({
    ...inst,
    startBeat: inst.startBeat + delta,
    endBeat: inst.endBeat != null ? inst.endBeat + delta : null,
  }));

  const spans = loopInstanceSpans(existingInstances);
  const { insertIndex, overlapsExisting } = searchPlacementAtBeat(
    spans,
    proposedStartBeat,
  );

  if (overlapsExisting) {
    return { proposedInstances: [], insertIndex };
  }

  const nextExistingStartBeat =
    insertIndex < spans.length ? spans[insertIndex].startBeat : null;
  const cutoffBeat =
    nextExistingStartBeat ?? compositionDims.compositionEndBeat;

  const valid = shifted.filter((inst) => inst.startBeat < cutoffBeat);

  const lastFit = findLastFittableInstance(
    valid,
    nextExistingStartBeat,
    definition,
    compositionDims,
  );

  if (lastFit == null) {
    return { proposedInstances: [], insertIndex };
  }

  const result = valid.slice(0, lastFit.index + 1);
  result[result.length - 1] = {
    ...result[result.length - 1],
    repeatCount: lastFit.repeatCount,
    endBeat: lastFit.endBeat,
  };

  return { proposedInstances: result, insertIndex };
}

function endBeatFromRepeatCount(
  instance: Pick<LayerLoopInstance, "startBeat">,
  repeatCount: number,
  definition: LoopDefinition,
  beatsPerMeasure: number,
): number {
  const spanBeats = definition.spanBeats;
  if (spanBeats == null) {
    throw new Error("endBeatFromRepeatCount requires finalized spanBeats.");
  }
  const step = repeatStrideBeats(definition, beatsPerMeasure);
  if (step == 0) return instance.startBeat + spanBeats;
  return instance.startBeat + repeatCount * step + spanBeats;
}

/**
 * Returns the largest valid repeatCount (possibly reduced) that fits in [startBeat, maxEndBeat].
 * For non-repeating loops (repeatEvery = null), repeatCount is 0.
 */
export function fitRepeatCountToWindow(
  instance: Pick<LayerLoopInstance, "startBeat" | "repeatCount">,
  maxEndBeat: number | null,
  definition: LoopDefinition,
  compositionDims: LoopInstanceCompositionDims,
): RepeatCountFitResult | null {
  const spanBeats = definition.spanBeats!;
  const startBeat = instance.startBeat;
  const endBeat =
    maxEndBeat == null
      ? compositionDims.compositionEndBeat
      : Math.min(compositionDims.compositionEndBeat, maxEndBeat ?? Infinity);
  if (spanBeats <= 0 || startBeat + spanBeats > endBeat) return null;
  const step = repeatStrideBeats(definition, compositionDims.beatsPerMeasure);
  let repeatCount: number;
  if (step == 0) {
    repeatCount = 0;
  } else {
    const maxRepeatCount = maxRepeatCountForEndBeat(
      startBeat,
      spanBeats,
      step,
      endBeat,
    );
    const preferredRepeatCount = instance.repeatCount ?? maxRepeatCount;
    repeatCount = Math.min(preferredRepeatCount, maxRepeatCount);
  }
  const finalEndBeat = endBeatFromRepeatCount(
    { startBeat },
    repeatCount,
    definition,
    compositionDims.beatsPerMeasure,
  );
  return {
    repeatCount: maxEndBeat == null ? null : repeatCount,
    endBeat: finalEndBeat,
  };
}

/** Returns true if sortedIds (ascending) form a contiguous (no-gap) run within [0, totalInstances). */
export function areInstanceIdsConsecutive(
  sortedIds: number[],
  totalInstances: number,
): boolean {
  if (sortedIds.length === 0) return false;
  if (sortedIds[0] < 0 || sortedIds[sortedIds.length - 1] >= totalInstances)
    return false;
  return (
    sortedIds[sortedIds.length - 1] - sortedIds[0] + 1 === sortedIds.length
  );
}

/**
 * Valid absolute startBeat range for the first selected instance when shifting the
 * whole consecutive group together.
 *
 * Hard constraints (always):
 *   - firstSelected.newStart >= prevNonSelected.endBeat (or 0)
 *   - lastSelected.newStart + spanBeats <= min(nextNonSelected.startBeat, compositionEnd)
 *
 * Additional hard constraint when lastSelected.repeatCount is non-null:
 *   - lastSelected full endBeat (newStart + repeatCount*stride + spanBeats) must also
 *     fit within min(nextNonSelected.startBeat, compositionEnd)
 *
 * When lastSelected.repeatCount is null, the endBeat overflow is soft (shown red in ghost,
 * trimmed on commit). Ticks are still limited to the hard start constraint.
 *
 * `sortedIds` must be sorted ascending by the caller.
 */
export function getValidShiftRange(
  instances: LayerLoopInstance[],
  sortedIds: number[],
  definition: LoopDefinition,
  compositionDims: LoopInstanceCompositionDims,
): { minFirstStart: number; maxFirstStart: number } {
  const { beatsPerMeasure, compositionEndBeat } = compositionDims;
  const spanBeats = definition.spanBeats!;
  const firstId = sortedIds[0];
  const lastId = sortedIds[sortedIds.length - 1];
  const firstInst = instances[firstId];
  const lastInst = instances[lastId];
  const stride = repeatStrideBeats(definition, beatsPerMeasure);

  const prevInst = firstId > 0 ? instances[firstId - 1] : null;
  const nextInst = lastId < instances.length - 1 ? instances[lastId + 1] : null;

  const minFirstStart = prevInst != null ? prevInst.endBeat! : 0;

  const blockingBeat = Math.min(
    nextInst != null ? nextInst.startBeat : Infinity,
    compositionEndBeat,
  );
  // Offset between first and last selected startBeat
  const groupSpread = lastInst.startBeat - firstInst.startBeat;

  // Hard: lastSelected.newStart + spanBeats <= blockingBeat
  const hardMaxFirst = blockingBeat - spanBeats - groupSpread;

  let maxFirstStart: number;
  if (lastInst.repeatCount !== null && stride > 0) {
    // Hard: lastSelected full endBeat must fit too
    const requiredSpan = lastInst.repeatCount * stride + spanBeats;
    maxFirstStart = Math.min(
      hardMaxFirst,
      blockingBeat - requiredSpan - groupSpread,
    );
  } else {
    maxFirstStart = hardMaxFirst;
  }

  return {
    minFirstStart,
    maxFirstStart: Math.max(minFirstStart, maxFirstStart),
  };
}

/**
 * Valid absolute startBeat range for a single instance being edited.
 * Hard min: previous instance endBeat (or 0).
 * Hard max: instance.endBeat - spanBeats (must still fit at least one play).
 */
export function getValidStartBeatRange(
  instances: LayerLoopInstance[],
  instanceIdx: number,
  definition: LoopDefinition,
): { min: number; max: number } {
  const spanBeats = definition.spanBeats!;
  const instance = instances[instanceIdx];
  const prevInst = instanceIdx > 0 ? instances[instanceIdx - 1] : null;
  const min = prevInst != null ? prevInst.endBeat! : 0;
  const max = instance.endBeat! - spanBeats;
  return { min, max: Math.max(min, max) };
}

/**
 * Valid endBeat range for a single instance being edited.
 *
 * Hard min: instance.startBeat + spanBeats (at least one play).
 * Hard max when repeatCount non-null: min(nextInst.startBeat, compositionEnd).
 * Soft max when repeatCount null: compositionEnd — caller may allow ticks beyond
 *   nextInst.startBeat (showing invalid overflow in red) and trims on commit.
 */
export function getValidEndBeatRange(
  instances: LayerLoopInstance[],
  instanceIdx: number,
  definition: LoopDefinition,
  compositionDims: LoopInstanceCompositionDims,
): { min: number; max: number; isSoftMax: boolean } {
  const { compositionEndBeat } = compositionDims;
  const spanBeats = definition.spanBeats!;
  const instance = instances[instanceIdx];
  const nextInst =
    instanceIdx < instances.length - 1 ? instances[instanceIdx + 1] : null;
  const min = instance.startBeat + spanBeats;
  const hardMax = Math.min(
    nextInst != null ? nextInst.startBeat : compositionEndBeat,
    compositionEndBeat,
  );
  const isSoftMax = instance.repeatCount === null;
  return {
    min,
    max: isSoftMax ? compositionEndBeat : hardMax,
    isSoftMax,
  };
}

/**
 * Recomputes per-instance repeatCount/endBeat for updated repeat settings, fitting each
 * instance before the next instance (or composition end).
 */
export function reflowInstanceRepeatsForDefinition(
  instances: LayerLoopInstance[],
  definition: LoopDefinition,
  compositionDims: LoopInstanceCompositionDims,
): RepeatCountFitResult[] {
  const repeatOff = isRepeatOff(definition);
  const next = instances.map((instance, idx) => {
    if (repeatOff) {
      return {
        repeatCount: null,
        endBeat: instance.startBeat + definition.spanBeats!,
      };
    }
    const nextStartBeat =
      idx + 1 < instances.length ? instances[idx + 1].startBeat : null;
    const maxEndBeat =
      instance.repeatCount == null && nextStartBeat == null
        ? null
        : Math.min(nextStartBeat ?? Infinity, instance.endBeat!);
    const fitted = fitRepeatCountToWindow(
      instance,
      maxEndBeat,
      definition,
      compositionDims,
    );
    if (fitted == null) {
      throw new Error("Failed to fit repeat count to window.");
    }
    return fitted;
  });
  return next;
}

export interface CompositionTrimResult {
  lastPlayableIndex: number;
  repeatCountAtLastPlayable: number | null;
  endBeatAtLastPlayable: number;
}

/**
 * Finds the final playable instance when composition length shrinks.
 * Caller can drop instances after `lastPlayableIndex` and update that instance's repeatCount/endBeat.
 * Returns null if no instance can be played in the new composition window.
 */
export function findLastPlayableInstanceForCompositionEnd(
  instances: LayerLoopInstance[],
  definition: LoopDefinition,
  compositionDims: LoopInstanceCompositionDims,
): CompositionTrimResult | null {
  const result = findLastFittableInstance(
    instances,
    null,
    definition,
    compositionDims,
  );
  if (!result) return null;
  return {
    lastPlayableIndex: result.index,
    repeatCountAtLastPlayable: result.repeatCount,
    endBeatAtLastPlayable: result.endBeat,
  };
}

/**
 * Re-evaluates the last instance after composition expansion.
 * Useful when that instance is open-ended (repeatCount=null) and may now extend farther.
 */
export function getExpandedRepeatInfoForLastInstance(
  instances: LayerLoopInstance[],
  definition: LoopDefinition,
  compositionDims: LoopInstanceCompositionDims,
): number | null {
  if (instances.length === 0) return null;
  const last = instances[instances.length - 1];
  if (last.repeatCount != null) return last.endBeat;
  const fitted = fitRepeatCountToWindow(
    last,
    null,
    definition,
    compositionDims,
  );
  return fitted?.endBeat ?? null;
}
