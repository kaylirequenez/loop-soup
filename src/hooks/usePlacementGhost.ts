/**
 * Hover/click placement preview when `layerEditorStore.pendingPlacement` is set (paste / add-instance flow).
 *
 * `pendingPlacement` is created from e.g. `BottomControls.tsx` or `armCopyPlacementFromSelection`; this hook reads it
 * and only draws interactive ghosts on `src/components/CompositionView.tsx` for the targeted loop row.
 *
 * Commit path: validated click → `layerStore.addLoopInstance` → `clearPendingPlacement`.
 * Geometry/consistency with existing instances: `getValidInstancesForProposedPlacement` in `loopInstanceUtils`.
 */
import { useMemo, useState } from "react";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerStore } from "../store/layerStore";
import { useShallow } from "zustand/react/shallow";
import { ghostNotesForInstance } from "../utils/loopTimeline";
import type { LayerId, LayerLoop } from "../types/layer";

export interface GhostEntry {
  startBeat: number;
  endBeat: number;
  notes: { startBeat: number; endBeat: number }[];
}

/** All ghosts for `pendingPlacement` at current `mouseBeat` (CompositionView overlays). */
export interface GhostData {
  loopId: number;
  ghosts: GhostEntry[];
}

interface PlacementGhookResult {
  ghostData: GhostData | null;
  getTrackProps: (loopId: number) => {
    onClick: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
  } | null;
}

interface UsePlacementGhostParams {
  selectedLayerId: LayerId;
  layerLoops: LayerLoop[];
  compositionBeats: number;
  beatsPerMeasure: number;
}

/**
 * @returns `ghostData` for overlays and `getTrackProps(loopIdx)` wiring for the active placement row only.
 */
export function usePlacementGhost({
  selectedLayerId,
  layerLoops,
  compositionBeats,
  beatsPerMeasure,
}: UsePlacementGhostParams): PlacementGhookResult {
  const { pendingPlacement, clearPendingPlacement } = useLayerEditorStore(
    useShallow((s) => ({
      pendingPlacement: s.pendingPlacement,
      clearPendingPlacement: s.clearPendingPlacement,
    })),
  );
  const addLoopInstance = useLayerStore((s) => s.addLoopInstance);

  /** Composition beat under the cursor on the placement row (`null` when pointer left the track). */
  const [mouseBeat, setMouseBeat] = useState<number | null>(null);

  const ghostData = useMemo<GhostData | null>(() => {
    if (pendingPlacement == null || mouseBeat == null) return null;
    if (pendingPlacement.layerId !== selectedLayerId) return null;
    const loop = layerLoops[pendingPlacement.loopId];
    if (!loop || loop.definition.spanBeats == null) return null;

    const ghosts: GhostEntry[] = pendingPlacement.instances.map((inst) => {
      const startBeat = inst.startBeat + mouseBeat;
      const rawEnd = inst.endBeat != null ? inst.endBeat + mouseBeat : compositionBeats;
      const endBeat = Math.min(Math.max(rawEnd, startBeat + loop.definition.spanBeats!), compositionBeats);
      const ghostInst = { startBeat, endBeat, repeatCount: inst.repeatCount };
      const notes = ghostNotesForInstance(
        selectedLayerId,
        loop.definition,
        ghostInst,
        beatsPerMeasure,
        compositionBeats,
      );
      return { startBeat, endBeat, notes };
    });
    return { ghosts, loopId: pendingPlacement.loopId };
  }, [pendingPlacement, mouseBeat, selectedLayerId, layerLoops, compositionBeats, beatsPerMeasure]);

  /** CompositionView calls this per loop row; only matching `pendingPlacement.loopId` returns handlers. */
  const getTrackProps = (loopId: number) => {
    if (pendingPlacement?.loopId !== loopId) return null;
    return {
      onClick: (e: React.MouseEvent) => {
        if (ghostData?.loopId === loopId && mouseBeat != null) {
          addLoopInstance(
            selectedLayerId,
            loopId,
            mouseBeat,
            { compositionEndBeat: compositionBeats, beatsPerMeasure },
            pendingPlacement.instances,
          );
          clearPendingPlacement();
        }
      },
      onMouseMove: (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMouseBeat(
          Math.max(0, ((e.clientX - rect.left) / rect.width) * compositionBeats),
        );
      },
      onMouseLeave: () => setMouseBeat(null),
    };
  };

  return { ghostData, getTrackProps };
}
