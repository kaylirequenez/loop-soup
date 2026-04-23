import type {
  Layer,
  LayerLoop,
  LayerLoopId,
  LayerLoopInstance,
  LayerLoopInstanceRow,
} from "../types/layer";
import type { LoopEditorFocus } from "../types/layerEditor";
import type { LoopDefinitionsState } from "../types/loop";

/** Timeline order: ascending `startMeasure`, then id. */
export function listLayerLoopInstancesSorted(
  loopOrLayer: LayerLoop | Layer,
): LayerLoopInstance[] {
  const instances =
    "layerLoops" in loopOrLayer
      ? Object.values(loopOrLayer.layerLoops).flatMap((loop) =>
          Object.values(loop.loopInstances),
        )
      : Object.values(loopOrLayer.loopInstances);
  return instances.sort((a, b) => {
    if (a.startMeasure !== b.startMeasure) {
      return a.startMeasure - b.startMeasure;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Layer loops in stable UI order.
 * Numeric-like ids are sorted numerically, otherwise insertion order fallback via locale.
 */
export function listLayerLoopsOrdered(
  layer: Layer,
): LayerLoop[] {
  return Object.values(layer.layerLoops).sort((a, b) => {
    const an = Number(a.id);
    const bn = Number(b.id);
    if (Number.isFinite(an) && Number.isFinite(bn)) {
      return an - bn;
    }
    return a.id.localeCompare(b.id);
  });
}

/** Flatten all loop instances into derived rows for timeline/repeat/MIDI calculations. */
export function layerLoopRowsForUi(
  layer: Layer,
  definitions: LoopDefinitionsState,
): LayerLoopInstanceRow[] {
  const out: LayerLoopInstanceRow[] = [];
  for (const loop of listLayerLoopsOrdered(layer)) {
    const def = definitions[loop.loopDefinitionId];
    const spanBeats =
      typeof def?.spanBeats === "number" && def.spanBeats > 0 ? def.spanBeats : 1;
    const notes = Array.isArray(def?.notes) ? def.notes : [];
    for (const inst of listLayerLoopInstancesSorted(loop)) {
      out.push({
        loopId: loop.id,
        loopInstanceId: inst.id,
        startMeasure: inst.startMeasure,
        repeatUnit: inst.repeatUnit,
        repeatEveryMeasuresMemory: inst.repeatEveryMeasuresMemory,
        repeatEveryBeatsMemory: inst.repeatEveryBeatsMemory,
        repeatEndMeasure: inst.repeatEndMeasure,
        spanBeats,
        notes,
      });
    }
  }
  return out;
}

/** Backward-compatible name used by existing MIDI/composition code. */
export const layerLoopsForUi = layerLoopRowsForUi;

/** Active instance row matching editor focus (loop id, definition id, or first fallback). */
export function activeLayerLoopForEditorFocus(
  layer: Layer,
  definitions: LoopDefinitionsState,
  focus: LoopEditorFocus | undefined,
): LayerLoopInstanceRow | null {
  const rows = layerLoopRowsForUi(layer, definitions);
  if (rows.length === 0) return null;
  if (focus?.kind === "loop") {
    return rows.find((l) => l.loopId === focus.loopId) ?? rows[0] ?? null;
  }
  if (focus?.kind === "instance") {
    return rows.find((l) => l.loopInstanceId === focus.loopInstanceId) ?? rows[0] ?? null;
  }
  if (focus?.kind === "definition") {
    const loops = listLayerLoopsOrdered(layer);
    const loop = loops.find((l) => l.loopDefinitionId === focus.loopDefinitionId);
    if (loop) {
      return rows.find((r) => r.loopId === loop.id) ?? rows[0] ?? null;
    }
    return (
      rows[0] ?? null
    );
  }
  return rows[0] ?? null;
}

export function getLayerLoopById(
  layer: Layer,
  loopId: LayerLoopId,
): LayerLoop | null {
  return layer.layerLoops[loopId] ?? null;
}
