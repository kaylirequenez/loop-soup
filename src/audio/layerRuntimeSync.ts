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

/** Build new Parts for freshly added instances (no prior Parts to dispose). */
export function syncAddInstances(
  layers: LayersState,
  layerId: LayerId,
  loopId: LayerLoopId,
  instances: LayerLoopInstance[],
): void {
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  const loop = layers[layerId].layerLoops[loopId];
  for (const instance of instances) {
    partEngine.buildForInstance(
      layerId,
      loopId,
      loop.definition,
      instance,
      loop.mapping,
      (id, mapping) => audioEngine.createLoopVoice(id, mapping),
    );
  }
}

/** Dispose old Parts and build new ones after instances are shifted. Rebuilds loop timeline once. */
export function syncShiftInstances(
  layers: LayersState,
  layerId: LayerId,
  loopId: LayerLoopId,
  oldStartBeats: number[],
  newInstances: LayerLoopInstance[],
): void {
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  const loop = layers[layerId].layerLoops[loopId];
  for (const startBeat of oldStartBeats) {
    partEngine.disposeForInstance(layerId, loopId, startBeat);
  }
  for (const instance of newInstances) {
    partEngine.buildForInstance(
      layerId,
      loopId,
      loop.definition,
      instance,
      loop.mapping,
      (id, mapping) => audioEngine.createLoopVoice(id, mapping),
    );
  }
}

/** Rebuild the Part for one updated instance. `oldStartBeat` is the key to dispose (differs from instance.startBeat when startBeat changed). */
export function syncRebuildInstance(
  layers: LayersState,
  layerId: LayerId,
  loopId: LayerLoopId,
  oldStartBeat: number,
  instance: LayerLoopInstance,
): void {
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  partEngine.disposeForInstance(layerId, loopId, oldStartBeat);
  partEngine.buildForInstance(
    layerId,
    loopId,
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
  startBeat: number,
): void {
  loopTimeline.rebuildLoop(layerId, loopId, layers);
  partEngine.disposeForInstance(layerId, loopId, startBeat);
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
  removedInstanceBeats: ReadonlyArray<{
    layerId: LayerId;
    loopId: number;
    startBeat: number;
  }>;
  rebuiltLast: ReadonlyArray<{
    layerId: LayerId;
    loopId: number;
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
  removedInstanceBeats,
  rebuiltLast,
}: SyncTrimInstancesParams): void {
  for (const key of affectedTimelineLoops) {
    const [layerId, loopIdStr] = key.split(":");
    loopTimeline.rebuildLoop(layerId as LayerId, Number(loopIdStr), layers);
  }

  for (const { layerId, loopId } of clearedLoops) {
    partEngine.disposeAllForLoop(layerId, loopId);
  }
  for (const { layerId, loopId, startBeat } of removedInstanceBeats) {
    partEngine.disposeForInstance(layerId, loopId, startBeat);
  }
  for (const { layerId, loopId, instance } of rebuiltLast) {
    const loop = layers[layerId].layerLoops[loopId];
    partEngine.disposeForInstance(layerId, loopId, instance.startBeat);
    partEngine.buildForInstance(
      layerId,
      loopId,
      loop.definition,
      instance,
      loop.mapping,
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

  for (const { layerId, loopId, instance } of rebuiltLast) {
    const loop = layers[layerId].layerLoops[loopId];
    partEngine.disposeForInstance(layerId, loopId, instance.startBeat);
    partEngine.buildForInstance(
      layerId,
      loopId,
      loop.definition,
      instance,
      loop.mapping,
      (id, loopMapping) => audioEngine.createLoopVoice(id, loopMapping),
    );
  }
}
