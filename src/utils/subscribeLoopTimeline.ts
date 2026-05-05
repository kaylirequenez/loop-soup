import { useCompositionStore } from "../store/compositionStore";
import { useLayerStore } from "../store/layerStore";
import { loopTimeline } from "./loopTimeline";

export function rebuildLoopTimelineFromStores(): void {
  loopTimeline.rebuildAll(useLayerStore.getState().layers);
}

/**
 * Purpose:
 * Keeps `loopTimeline` aligned with composition length / meter (and after layer rehydrate).
 *
 * Behavior:
 * - Layer edits call `loopTimeline` from `layerStore` (no blanket layer subscription).
 */
export function subscribeLoopTimeline(): () => void {
  rebuildLoopTimelineFromStores();
  const unsubComp =
    useCompositionStore.subscribe(rebuildLoopTimelineFromStores);
  const unsubHydrate = useLayerStore.persist.onFinishHydration(() => {
    rebuildLoopTimelineFromStores();
  });
  return () => {
    unsubComp();
    unsubHydrate();
  };
}
