import type { LayerLoop, LayerLoopInstance } from "../types/layer";

/** Timeline order: ascending `startBeat`, then id. */
export function listLayerLoopInstancesSorted(
  loop: LayerLoop,
): LayerLoopInstance[] {
  return Object.values(loop.loopInstances).sort((a, b) => {
    if (a.startBeat !== b.startBeat) {
      return a.startBeat - b.startBeat;
    }
    return a.id - b.id;
  });
}

