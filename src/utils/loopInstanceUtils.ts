import type { LayerLoopInstance, LoopDefinition } from "../types/layer";
import { getRepeatEveryForUnit } from "./layerState";

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

/**
 * Returns a finalized instance's end beat.
 * Utilities in this module assume finalized instances only.
 */
export function getLoopInstanceEndBeat(instance: LayerLoopInstance): number {
  if (instance.endBeat == null) {
    throw new Error("Expected finalized loop instance with non-null endBeat.");
  }
  return instance.endBeat;
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
            endBeat: Math.ceil(getLoopInstanceEndBeat(instance)),
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

export interface ValidInstanceInfo {
  repeatCount: number | null;
  endBeat: number;
}

export interface RepeatCountFitResult extends ValidInstanceInfo {}

export interface PlacementResult extends ValidInstanceInfo {
  insertIndex: number;
}

/**
 * Computes placement info for a new/moved instance.
 * `existingInstances` should be current placements (excluding the proposed row if not yet stored).
 */
export function getValidInstanceInfoForProposedStart(
  existingInstances: LayerLoopInstance[],
  proposedInstance: LayerLoopInstance,
  definition: LoopDefinition,
  compositionDims: LoopInstanceCompositionDims,
): PlacementResult | null {
  const spanBeats = definition.spanBeats;
  if (spanBeats == null || spanBeats <= 0) return null;
  const { compositionEndBeat, beatsPerMeasure } = compositionDims;
  const proposedStart = proposedInstance.startBeat;
  const spans = loopInstanceSpans(existingInstances);

  const placement = searchPlacementAtBeat(spans, proposedStart);
  if (placement.overlapsExisting) {
    return null;
  }

  const insertIndex = placement.insertIndex;
  const nextStartBeat =
    insertIndex < spans.length ? spans[insertIndex].startBeat : Infinity;
  const maxAllowedEndBeat = Math.min(compositionEndBeat, nextStartBeat);

  if (proposedStart + spanBeats > maxAllowedEndBeat) {
    return null;
  }

  const fitted = fitRepeatCountToWindow(
    proposedInstance,
    maxAllowedEndBeat,
    definition,
    beatsPerMeasure,
  );
  if (fitted == null) return null;

  return {
    insertIndex,
    repeatCount: fitted.repeatCount,
    endBeat: fitted.endBeat,
  };
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
  maxEndBeat: number,
  definition: LoopDefinition,
  beatsPerMeasure: number,
): RepeatCountFitResult | null {
  const spanBeats = definition.spanBeats;
  if (spanBeats == null) return null;
  const startBeat = instance.startBeat;
  if (spanBeats <= 0 || startBeat + spanBeats > maxEndBeat) return null;
  const step = repeatStrideBeats(definition, beatsPerMeasure);
  let repeatCount: number;
  if (step == 0) {
    repeatCount = 0;
  } else {
    const maxRepeatCount = maxRepeatCountForEndBeat(
      startBeat,
      spanBeats,
      step,
      maxEndBeat,
    );
    const preferredRepeatCount = instance.repeatCount ?? maxRepeatCount;
    repeatCount = Math.min(preferredRepeatCount, maxRepeatCount);
  }
  return {
    repeatCount,
    endBeat: endBeatFromRepeatCount({ startBeat }, repeatCount, definition, beatsPerMeasure),
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
  const spanBeats = definition.spanBeats;
  if (spanBeats == null) {
    return instances.map((i) => ({
      repeatCount: i.repeatCount,
      endBeat: i.endBeat ?? i.startBeat,
    }));
  }
  const { compositionEndBeat, beatsPerMeasure } = compositionDims;
  return instances.map((instance, idx) => {
    const nextStartBeat =
      idx + 1 < instances.length ? instances[idx + 1].startBeat : Infinity;
    const maxEndBeat = Math.min(compositionEndBeat, nextStartBeat);
    const fitted = fitRepeatCountToWindow(
      instance,
      maxEndBeat,
      definition,
      beatsPerMeasure,
    );
    if (fitted == null) {
      return {
        repeatCount: 0,
        endBeat: instance.startBeat + spanBeats,
      };
    }
    return fitted;
  });
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
  const spanBeats = definition.spanBeats;
  if (spanBeats == null) return null;
  const { compositionEndBeat, beatsPerMeasure } = compositionDims;
  for (let i = instances.length - 1; i >= 0; i--) {
    const instance = instances[i];
    const fitted = fitRepeatCountToWindow(
      instance,
      compositionEndBeat,
      definition,
      beatsPerMeasure,
    );
    if (!fitted) continue;
    return {
      lastPlayableIndex: i,
      repeatCountAtLastPlayable: fitted.repeatCount,
      endBeatAtLastPlayable: fitted.endBeat,
    };
  }
  return null;
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
  const spanBeats = definition.spanBeats;
  if (spanBeats == null) return null;
  const { compositionEndBeat, beatsPerMeasure } = compositionDims;
  const last = instances[instances.length - 1];
  if (last.repeatCount != null) return last.endBeat;
  const fitted = fitRepeatCountToWindow(
    last,
    compositionEndBeat,
    definition,
    beatsPerMeasure,
  );
  return fitted?.endBeat ?? null;
}
