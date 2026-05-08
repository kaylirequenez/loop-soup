import { audioEngine } from "./audioEngine";
import { partEngine } from "./partEngine";
import type {
  LayerId,
  LayerLoopId,
  LayerLoopInstance,
  LayersState,
  LoopDefinition,
} from "../types/layer";
import { loopTimeline } from "../utils/loopTimeline";

/** Full Part rebuild for a loop — use when note content, repeat stride, or all instance bounds changed. */
export function syncTimelineLoop(
  layers: LayersState,
  layerId: LayerId,
  loopId: LayerLoopId,
): void {
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  partEngine.rebuildAllForLoop(
    layerId,
    loopId,
    layers[layerId].layerLoops[loopId],
    (id, mapping) => audioEngine.createLoopVoice(id, mapping),
  );
}

/** Rebuild only the Parts/synths for a loop whose mapping (sound/effects) changed. */
export function syncLoopMapping(
  layers: LayersState,
  layerId: LayerId,
  loopId: LayerLoopId,
): void {
  const loop = layers[layerId]?.layerLoops[loopId];
  if (!loop) return;
  partEngine.updateLoopSynthMapping(
    layerId,
    loopId,
    loop.mapping,
  );
}

/** Build one new Part for a freshly added instance (no prior Part to dispose). */
export function syncAddInstance(
  layers: LayersState,
  layerId: LayerId,
  loopId: LayerLoopId,
  instanceId: number,
  definition: LoopDefinition,
  instance: LayerLoopInstance,
): void {
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  partEngine.buildForInstance(
    layerId,
    loopId,
    instanceId,
    definition,
    instance,
    layers[layerId].layerLoops[loopId].mapping,
    (id, mapping) => audioEngine.createLoopVoice(id, mapping),
  );
}

/** Rebuild the Part for one updated instance id. */
export function syncRebuildInstance(
  layers: LayersState,
  layerId: LayerId,
  loopId: LayerLoopId,
  instanceId: number,
  instance: LayerLoopInstance,
): void {
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  partEngine.disposeForInstance(layerId, loopId, instanceId);
  partEngine.buildForInstance(
    layerId,
    loopId,
    instanceId,
    layers[layerId].layerLoops[loopId].definition,
    instance,
    layers[layerId].layerLoops[loopId].mapping,
    (id, mapping) => audioEngine.createLoopVoice(id, mapping),
  );
}

/** Dispose the Part for one deleted instance. */
export function syncDeleteInstance(
  layers: LayersState,
  layerId: LayerId,
  loopId: LayerLoopId,
  instanceId: number,
): void {
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  partEngine.disposeForInstance(layerId, loopId, instanceId);
}

/** Update note content for an existing loop without changing placements. */
export function syncLoopDefinitionNotes(
  layers: LayersState,
  layerId: LayerId,
  loopId: LayerLoopId,
): void {
  const definition = layers[layerId]?.layerLoops[loopId]?.definition;
  if (!definition) return;
  partEngine.updateLoopNotesInPlace(layerId, loopId, definition);
}

/** Dispose all Parts for a loop whose instances were cleared (loop still exists in state). */
export function syncClearLoop(
  layers: LayersState,
  layerId: LayerId,
  loopId: LayerLoopId,
): void {
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  partEngine.disposeAllForLoop(layerId, loopId);
}

/** Dispose all Parts for a loop that was deleted from state (loopId no longer valid). */
export function syncDeleteLoop(layerId: LayerId, loopId: LayerLoopId): void {
  loopTimeline.invalidateLoop(layerId, loopId);
  partEngine.disposeAllForLoop(layerId, loopId);
}

interface SyncTrimInstancesParams {
  layers: LayersState;
  affectedTimelineLoops: ReadonlySet<string>;
  clearedLoops: ReadonlyArray<{ layerId: LayerId; loopId: number }>;
  removedInstanceIds: ReadonlyArray<{
    layerId: LayerId;
    loopId: number;
    instanceId: number;
  }>;
  rebuiltLast: ReadonlyArray<{
    layerId: LayerId;
    loopId: number;
    instanceId: number;
    instance: LayerLoopInstance;
  }>;
}

/**
 * Applies runtime sync for trim-to-composition mutations.
 * Call after store state has been committed.
 */
export function syncTrimInstancesToComposition({
  layers,
  affectedTimelineLoops,
  clearedLoops,
  removedInstanceIds,
  rebuiltLast,
}: SyncTrimInstancesParams): void {
  for (const key of affectedTimelineLoops) {
    const [layerId, loopIdStr] = key.split(":");
    loopTimeline.rebuildLoop(layerId as LayerId, Number(loopIdStr), layers);
  }

  for (const { layerId, loopId } of clearedLoops) {
    partEngine.disposeAllForLoop(layerId, loopId);
  }
  for (const { layerId, loopId, instanceId } of removedInstanceIds) {
    partEngine.disposeForInstance(layerId, loopId, instanceId);
  }
  for (const { layerId, loopId, instanceId, instance } of rebuiltLast) {
    const mapping = layers[layerId].layerLoops[loopId].mapping;
    partEngine.disposeForInstance(layerId, loopId, instanceId);
    partEngine.buildForInstance(
      layerId,
      loopId,
      instanceId,
      layers[layerId].layerLoops[loopId].definition,
      instance,
      mapping,
      (id, loopMapping) => audioEngine.createLoopVoice(id, loopMapping),
    );
  }
}

interface SyncExpandInstancesParams {
  layers: LayersState;
  affectedTimelineLoops: ReadonlySet<string>;
  rebuiltLast: ReadonlyArray<{
    layerId: LayerId;
    loopId: number;
    instanceId: number;
    instance: LayerLoopInstance;
  }>;
}

/**
 * Applies runtime sync for expand-to-composition mutations.
 * Call after store state has been committed.
 */
export function syncExpandInstancesToComposition({
  layers,
  affectedTimelineLoops,
  rebuiltLast,
}: SyncExpandInstancesParams): void {
  for (const key of affectedTimelineLoops) {
    const [layerId, loopIdStr] = key.split(":");
    loopTimeline.rebuildLoop(layerId as LayerId, Number(loopIdStr), layers);
  }

  for (const { layerId, loopId, instanceId, instance } of rebuiltLast) {
    const mapping = layers[layerId].layerLoops[loopId].mapping;
    partEngine.disposeForInstance(layerId, loopId, instanceId);
    partEngine.buildForInstance(
      layerId,
      loopId,
      instanceId,
      layers[layerId].layerLoops[loopId].definition,
      instance,
      mapping,
      (id, loopMapping) => audioEngine.createLoopVoice(id, loopMapping),
    );
  }
}
