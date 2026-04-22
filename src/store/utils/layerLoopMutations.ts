import { createDefaultLoop } from "../../lib/loopModel";
import type { LayerId, LayerLoop, LayersState } from "../../types/model";

export interface ActiveLoopMutationResult {
  layers: LayersState;
  nextLoop: LayerLoop;
}

export function withMutatedActiveLayerLoop(
  layers: LayersState,
  layerId: LayerId,
  mutate: (loop: LayerLoop) => LayerLoop,
): ActiveLoopMutationResult {
  const layer = layers[layerId];
  const sourceLoops = layer.loops.length > 0 ? layer.loops : [createDefaultLoop()];
  const activeLoopIndex = Math.max(
    0,
    Math.min(sourceLoops.length - 1, layer.activeLoopIndex ?? 0),
  );
  const loops = [...sourceLoops];
  const currentLoop = loops[activeLoopIndex] ?? createDefaultLoop();
  const nextLoop = mutate({ ...currentLoop });
  loops[activeLoopIndex] = nextLoop;
  return {
    nextLoop,
    layers: {
      ...layers,
      [layerId]: {
        ...layer,
        activeLoopIndex,
        loops,
      },
    },
  };
}
