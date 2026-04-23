import { layerLoopRowsForUi } from "../../lib/layerRuntime";
import type { LayerId, LayerLoopInstanceRow, LayersState } from "../../types/layer";
import { useLayerEditorStore } from "../layerEditorStore";
import { useLoopDefinitionStore } from "../loopDefinitionStore";

export interface ActiveLoopMutationResult {
  layers: LayersState;
  nextLoop: LayerLoopInstanceRow;
}

function activeLoopIndexForRows(
  layerId: LayerId,
  layers: LayersState,
  rows: LayerLoopInstanceRow[],
): number {
  const focus = useLayerEditorStore.getState().selectedLoopFocusByLayer[layerId];
  if (focus?.kind === "loop") {
    const idx = rows.findIndex((l) => l.loopId === focus.loopId);
    return idx >= 0 ? idx : 0;
  }
  if (focus?.kind === "instance") {
    const idx = rows.findIndex((l) => l.loopInstanceId === focus.loopInstanceId);
    return idx >= 0 ? idx : 0;
  }
  if (focus?.kind === "definition") {
    const layer = layers[layerId];
    const idx = rows.findIndex((l) => {
      const loop = layer.layerLoops[l.loopId];
      return loop?.loopDefinitionId === focus.loopDefinitionId;
    });
    return idx >= 0 ? idx : 0;
  }
  return 0;
}

export function withMutatedActiveLayerLoop(
  layers: LayersState,
  layerId: LayerId,
  mutate: (loop: LayerLoopInstanceRow) => LayerLoopInstanceRow,
): ActiveLoopMutationResult {
  const defs = useLoopDefinitionStore.getState().definitions;
  const layer = layers[layerId];
  const loops = layerLoopRowsForUi(layer, defs);
  const activeLoopIndexValue = activeLoopIndexForRows(layerId, layers, loops);
  const currentLoop = loops[activeLoopIndexValue];
  if (!currentLoop) {
    return {
      layers,
      nextLoop: {
        loopId: "1",
        loopInstanceId: "1",
        startMeasure: 1,
        repeatUnit: "measures",
        repeatEveryMeasuresMemory: null,
        repeatEveryBeatsMemory: null,
        repeatEndMeasure: null,
        spanBeats: 1,
        notes: [],
      },
    };
  }
  const nextLoop = mutate({ ...currentLoop });
  const targetLoop = layer.layerLoops[nextLoop.loopId];
  const instance = targetLoop?.loopInstances[nextLoop.loopInstanceId];
  if (!targetLoop || !instance) {
    return { layers, nextLoop };
  }
  const defId = targetLoop.loopDefinitionId;
  const nextDefs = {
    ...defs,
    [defId]: {
      id: defId,
      spanBeats: Math.max(1, Number(nextLoop.spanBeats) || 1),
      notes: Array.isArray(nextLoop.notes) ? nextLoop.notes : [],
    },
  };
  useLoopDefinitionStore.setState({ definitions: nextDefs });
  const nextLayer = {
    ...layer,
    layerLoops: {
      ...layer.layerLoops,
      [targetLoop.id]: {
        ...targetLoop,
        loopInstances: {
          ...targetLoop.loopInstances,
          [instance.id]: {
            ...instance,
            startMeasure: nextLoop.startMeasure,
            repeatUnit: nextLoop.repeatUnit,
            repeatEveryMeasuresMemory: nextLoop.repeatEveryMeasuresMemory,
            repeatEveryBeatsMemory: nextLoop.repeatEveryBeatsMemory,
            repeatEndMeasure: nextLoop.repeatEndMeasure ?? null,
          },
        },
      },
    },
  };
  return {
    nextLoop,
    layers: {
      ...layers,
      [layerId]: nextLayer,
    },
  };
}
