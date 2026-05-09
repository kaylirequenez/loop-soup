import { useLayerEditorStore } from "../../store/layerEditorStore";
import { useLayerStore } from "../../store/layerStore";
import type { InstanceEditMode } from "../../types/layerEditor";
import {
  applyShiftNudge,
  applyStartNudge,
  applyEndNudge,
  commitInstanceEdit,
  tryBeginInstanceEdit,
  armCopyPlacementFromSelection,
  canBeginInstanceEdit,
} from "../../hooks/instanceEditSession";

function modeFromKeyEvent(
  e: KeyboardEvent,
  isTextInput: boolean,
): InstanceEditMode | null {
  if (isTextInput) return null;
  if (e.key === "z") return "start";
  if (e.key === "x") return "end";
  if (e.key === "Meta" || e.key === "Control") {
    return "shift";
  }
  return null;
}

/**
 * App-wide key handling. Instance edit **actions** live in `hooks/instanceEditSession.ts`;
 * key routing for those actions is here alongside placement / copy / delete.
 */
export function handleGlobalKeyDown(e: KeyboardEvent): void {
  const tag = (e.target as HTMLElement).tagName;
  const isTextInput = tag === "INPUT" || tag === "TEXTAREA";

  let es = useLayerEditorStore.getState();

  // ⌘/Ctrl+C: leave instance edit if active, then arm copy placement (single path; no dead branches).
  if (
    !isTextInput &&
    (e.metaKey || e.ctrlKey) &&
    (e.key === "c" || e.code === "KeyC")
  ) {
    if (!es.instanceEditState) {
      armCopyPlacementFromSelection();
    }
    return;
  }

  // --- Instance edit (session API in instanceEditSession.ts) ---
  if (es.instanceEditState) {
    const loop =
      es.selectedLoopId != null
        ? useLayerStore.getState().layers[es.selectedLayerId]?.layerLoops[
            es.selectedLoopId
          ]
        : undefined;
    const requestedMode = modeFromKeyEvent(e, isTextInput);
    if (requestedMode != null) {
      if (!loop || !canBeginInstanceEdit(requestedMode, es.selectedInstanceIds, loop)) return;
      e.preventDefault();
      es.setInstanceEditMode(requestedMode);
      return;
    }
    if (e.key === "Escape" || e.key === "e") {
      e.preventDefault();
      es.cancelInstanceEdit();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commitInstanceEdit();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const dir = e.key === "ArrowLeft" ? -1 : 1;
      const mode = es.instanceEditState.activeMode;
      if (mode === "shift") {
        if (e.metaKey || e.ctrlKey) es.setInstanceEditMode("shift");
        applyShiftNudge(dir as 1 | -1);
      } else if (mode === "start") {
        applyStartNudge(dir as 1 | -1);
      } else {
        applyEndNudge(dir as 1 | -1);
      }
      return;
    }
    return;
  }

  if (e.key === "Escape") {
    const { pendingPlacement, clearPendingPlacement } = es;
    if (pendingPlacement != null) {
      if (pendingPlacement.originLoopId != null) {
        useLayerStore.getState().deleteLoop(es.selectedLayerId, pendingPlacement.loopId);
        es.selectLoop(es.selectedLayerId, pendingPlacement.originLoopId);
      }
      clearPendingPlacement();
      return;
    }
  }

  // --- Placement-mode navigation (ArrowDown/Up) ---
  if (!isTextInput && es.pendingPlacement != null) {
    if (e.key === "ArrowDown" && es.pendingPlacement.originLoopId == null) {
      e.preventDefault();
      const { selectedLayerId } = es;
      const fromLoopId = es.pendingPlacement.loopId;
      const newLoopId = useLayerStore.getState().layers[selectedLayerId].layerLoops.length;
      useLayerStore.getState().duplicateLoop(selectedLayerId, fromLoopId);
      es.setPendingPlacement({ ...es.pendingPlacement, loopId: newLoopId, originLoopId: fromLoopId });
      return;
    }
    if (e.key === "ArrowUp" && es.pendingPlacement.originLoopId != null) {
      e.preventDefault();
      const { selectedLayerId } = es;
      const tempLoopId = es.pendingPlacement.loopId;
      const originLoopId = es.pendingPlacement.originLoopId;
      useLayerStore.getState().deleteLoop(selectedLayerId, tempLoopId);
      es.selectLoop(selectedLayerId, originLoopId);
      es.setPendingPlacement({ ...es.pendingPlacement, loopId: originLoopId, originLoopId: undefined });
      return;
    }
  }

  if (e.key === "e" && !isTextInput) {
    e.preventDefault();
    tryBeginInstanceEdit("shift");
    return;
  }

  const requestedMode = modeFromKeyEvent(e, isTextInput);
  if (requestedMode != null) {
    e.preventDefault();
    tryBeginInstanceEdit(requestedMode);
    return;
  }

  if (e.key === "Delete" || e.key === "Backspace") {
    if (isTextInput) return;

    const { selectedLayerId, selectedLoopId, selectedInstanceIds } = es;
    if (selectedLayerId === null) return;

    const { deleteLoopInstance, deleteLoop } = useLayerStore.getState();

    if (selectedLoopId !== null && selectedInstanceIds.length > 0) {
      [...selectedInstanceIds]
        .sort((a, b) => b - a)
        .forEach((id) =>
          deleteLoopInstance(selectedLayerId, selectedLoopId!, id),
        );
    } else if (selectedLoopId !== null) {
      deleteLoop(selectedLayerId, selectedLoopId);
    }
  }
}
