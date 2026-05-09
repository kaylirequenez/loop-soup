/**
 * Editing existing loop instances (shift / trim start / trim end) while
 * `layerEditorStore.instanceEditState` is set.
 *
 * Caller: `src/components/CompositionView.tsx` — edit-mode ruler ticks, EditGhostSpan overlays
 * (original spans/notes hidden on that row), ruler `handleRulerClick` → `updateProposedInstances`.
 *
 * Related: imperative edit actions — `instanceEditSession.ts` (keyboard routing in `globalKeyHandler.ts`).
 */
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerStore } from "../store/layerStore";
import {
  repeatStrideBeats,
  getValidShiftRange,
  getValidStartBeatRange,
  getValidEndBeatRange,
} from "../utils/loopInstanceUtils";
import type { LoopInstanceCompositionDims } from "../utils/loopInstanceUtils";
import { ghostNotesForInstance } from "../utils/loopTimeline";

export interface EditGhostSpan {
  startBeat: number;
  endBeat: number;
  notes: { startBeat: number; endBeat: number }[];
}

export interface InstanceEditorResult {
  /** Beat positions for tick marks on the ruler. */
  rulerTicks: number[];
  /** Per-loop-id ghost spans to render. */
  ghostsByLoopId: Map<number, EditGhostSpan[]>;
  /** Call with the beat value of a tick and the ruler container width+left to check proximity. */
  onRulerClick: (beatAtClick: number, containerWidthPx: number) => void;
}

const EMPTY: InstanceEditorResult = {
  rulerTicks: [],
  ghostsByLoopId: new Map(),
  onRulerClick: () => {},
};

/** Ruler snap: ignore clicks farther than this from the nearest tick (in screen px). */
const TICK_HIT_PX = 8;

export function useInstanceEditor(
  loopId: number | null,
  compositionDims: LoopInstanceCompositionDims,
): InstanceEditorResult {
  const { selectedLayerId, instanceEditState } = useLayerEditorStore(
    useShallow((s) => ({
      selectedLayerId: s.selectedLayerId,
      instanceEditState: s.instanceEditState,
    })),
  );

  const layerLoop = useLayerStore((s) =>
    loopId != null
      ? (s.layers[selectedLayerId]?.layerLoops[loopId] ?? null)
      : null,
  );

  return useMemo<InstanceEditorResult>(() => {
    if (
      !instanceEditState ||
      loopId == null ||
      !layerLoop ||
      layerLoop.definition.spanBeats == null
    ) {
      return EMPTY;
    }

    const { activeMode, sortedIds, proposedInstances } = instanceEditState;
    const { definition } = layerLoop;
    const { beatsPerMeasure, compositionEndBeat } = compositionDims;
    const spanBeats = definition.spanBeats!;
    const stride = repeatStrideBeats(definition, beatsPerMeasure);
    const selectedSet = new Set(sortedIds);

    // --- Ruler ticks ---
    const tickStep =
      activeMode === "shift" ? 1 : stride > 0 ? stride : spanBeats;
    let firstBeat: number;
    let lastBeat: number;

    if (activeMode === "shift") {
      const { minFirstStart, maxFirstStart } = getValidShiftRange(
        proposedInstances,
        sortedIds,
        definition,
        compositionDims,
      );
      firstBeat = Math.ceil(minFirstStart);
      lastBeat = maxFirstStart;
    } else if (activeMode === "start") {
      const idx = sortedIds[0];
      const { min, max } = getValidStartBeatRange(
        proposedInstances,
        idx,
        definition,
      );
      const anchor = proposedInstances[idx].startBeat;
      firstBeat = anchor + Math.ceil((min - anchor) / tickStep) * tickStep;
      lastBeat = max;
    } else {
      const idx = sortedIds[0];
      const inst = proposedInstances[idx];
      const { min, max } = getValidEndBeatRange(
        proposedInstances,
        idx,
        definition,
        compositionDims,
      );
      const anchorEnd = inst.startBeat + spanBeats;
      firstBeat =
        anchorEnd + Math.ceil((min - anchorEnd) / tickStep) * tickStep;
      lastBeat = max;
    }

    const rulerTicks: number[] = [];
    for (let b = firstBeat; b <= lastBeat; b += tickStep) {
      rulerTicks.push(b);
    }

    // --- Ghost spans (one per selected instance) ---
    const ghostSpans: EditGhostSpan[] = sortedIds.map((id) => {
      const proposed = proposedInstances[id];
      const endBeat = proposed.endBeat ?? compositionEndBeat;
      const notes = ghostNotesForInstance(
        selectedLayerId,
        definition,
        { ...proposed, endBeat },
        beatsPerMeasure,
        compositionEndBeat,
      );
      return { startBeat: proposed.startBeat, endBeat, notes };
    });

    const ghostsByLoopId = new Map<number, EditGhostSpan[]>();
    ghostsByLoopId.set(loopId, ghostSpans);

    const onRulerClick = (beatAtClick: number, containerWidthPx: number) => {
      const beatsPerPx = compositionEndBeat / containerWidthPx;
      const thresholdBeats = TICK_HIT_PX * beatsPerPx;
      let closest: number | null = null;
      let closestDist = Infinity;
      for (const tick of rulerTicks) {
        const dist = Math.abs(tick - beatAtClick);
        if (dist < closestDist) {
          closestDist = dist;
          closest = tick;
        }
      }
      if (closest == null || closestDist > thresholdBeats) return;

      const es = useLayerEditorStore.getState();
      if (!es.instanceEditState) return;
      const { sortedIds: sIds, proposedInstances: pi } = es.instanceEditState;
      const { updateProposedInstances } = es;

      if (activeMode === "shift") {
        const firstId = sIds[0];
        const delta = closest - pi[firstId].startBeat;
        if (delta === 0) return;
        const next = pi.map((inst, i) => {
          if (!selectedSet.has(i)) return inst;
          const newStart = inst.startBeat + delta;
          let newEnd: number;
          if (inst.repeatCount === null) {
            newEnd = compositionEndBeat;
          } else if (stride > 0) {
            newEnd = newStart + inst.repeatCount * stride + spanBeats;
          } else {
            newEnd = newStart + spanBeats;
          }
          return { ...inst, startBeat: newStart, endBeat: newEnd };
        });
        updateProposedInstances(next);
      } else if (activeMode === "start") {
        const idx = sIds[0];
        const next = pi.map((inst2, i) => {
          if (i !== idx) return inst2;
          if (inst2.repeatCount === null) {
            return { ...inst2, startBeat: closest! };
          }
          const newRepeatCount =
            stride > 0
              ? Math.max(
                  0,
                  Math.round((inst2.endBeat! - closest! - spanBeats) / stride),
                )
              : 0;
          return { ...inst2, startBeat: closest!, repeatCount: newRepeatCount };
        });
        updateProposedInstances(next);
      } else {
        const idx = sIds[0];
        const next = pi.map((inst2, i) => {
          if (i !== idx) return inst2;
          const finalRepeatCount =
            stride > 0
              ? Math.round((closest! - inst2.startBeat - spanBeats) / stride)
              : 0;
          return { ...inst2, endBeat: closest!, repeatCount: finalRepeatCount };
        });
        updateProposedInstances(next);
      }
    };

    return { rulerTicks, ghostsByLoopId, onRulerClick };
  }, [instanceEditState, loopId, layerLoop, compositionDims]);
}
