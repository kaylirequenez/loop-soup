import { useLayerEditorStore } from "../../store/layerEditorStore";
import { useCompositionStore } from "../../store/compositionStore";
import { useLayerPlaybackStore } from "../../store/layerPlaybackStore";
import { useLayerStore } from "../../store/layerStore";
import { useTransportStore } from "../../store/transportStore";
import { useWorkspaceUiStore } from "../../store/workspaceUiStore";
import type { AppView } from "../../types/app";
import { LAYER_IDS, type LayerId } from "../../types/layer";
import type { InstanceEditMode } from "../../types/layerEditor";
import { loopOctaveBoundsForKey } from "../../utils/compositionState";
import { canShiftLoopNotesOctaveBy, isRepeatOff } from "../../utils/layerState";
import { getSelectedKnobPages } from "../effects/knobPages";
import {
  addCompositionMeasure,
  getCompositionDims,
  removeCompositionMeasure,
  toggleLoopRecording,
} from "./controlActions";
import {
  applyShiftNudge,
  applyStartNudge,
  applyEndNudge,
  commitInstanceEdit,
  tryBeginInstanceEdit,
  armCopyPlacementFromSelection,
  canBeginInstanceEdit,
} from "../../hooks/instanceEditSession";

export const GLOBAL_KEY_DOCK = [
  {
    label: "layers",
    items: [
      ["g", "layer A"],
      ["h", "layer B"],
      ["j", "layer C"],
      ["k", "layer D"],
      ["l", "layer E"],
      ["1-9", "loop"],
    ],
  },
  {
    label: "transport",
    items: [
      ["space", "play"],
      ["r", "record"],
      ["d", "pitch mode"],
      ["z/x", "-/+ measure"],
      ["up/down", "octave"],
      ["cmd up/down", "loop octave"],
    ],
  },
  {
    label: "workspace",
    items: [
      ["q/w/e", "views"],
      [";/'", "effects/sounds"],
      ["m/n", "mute/solo"],
    ],
  },
  {
    label: "edit",
    items: [
      ["a/s", "trim start/end"],
      ["←/→", "instances"],
      ["cmd ←/→", "add select"],
      ["opt ←/→", "repeat"],
      ["=", "add instance"],
    ],
  },
  {
    label: "knobs",
    items: [
      ["y/u/i/o/p", "pages"],
      [",/.", "prev/next"],
    ],
  },
] as const;

function modeFromKeyEvent(
  e: KeyboardEvent,
  isTextInput: boolean,
): InstanceEditMode | null {
  if (isTextInput) return null;
  if (e.key === "Meta" || e.key === "Control") {
    return "shift";
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key.toLowerCase() === "a") return "start";
  if (e.key.toLowerCase() === "s") return "end";
  return null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

function layerIdFromKeyEvent(e: KeyboardEvent): LayerId | null {
  if (e.key.toLowerCase() === "g") return "A";
  if (e.key.toLowerCase() === "h") return "B";
  if (e.key.toLowerCase() === "j") return "C";
  if (e.key.toLowerCase() === "k") return "D";
  if (e.key.toLowerCase() === "l") return "E";
  return null;
}

function setViewFromKey(key: string): boolean {
  const viewByKey: Record<string, AppView> = {
    q: "layers",
    w: "midi",
    e: "dual",
  };
  const view = viewByKey[key.toLowerCase()];
  if (!view) return false;
  useWorkspaceUiStore.getState().setCurrentView(view);
  return true;
}

function selectLoopByNumber(key: string): boolean {
  if (!/^[1-9]$/.test(key)) return false;
  const loopIndex = Number(key) - 1;
  const editor = useLayerEditorStore.getState();
  const loops =
    useLayerStore.getState().layers[editor.selectedLayerId]?.layerLoops ?? [];
  if (loops.length === 0) return true;
  editor.selectLoop(editor.selectedLayerId, Math.min(loopIndex, loops.length - 1));
  return true;
}

function transposeSelectedLoop(delta: 1 | -1): boolean {
  const editor = useLayerEditorStore.getState();
  if (editor.selectedLoopId == null) return false;
  const loop =
    useLayerStore.getState().layers[editor.selectedLayerId]?.layerLoops[
      editor.selectedLoopId
    ];
  if (!loop || !canShiftLoopNotesOctaveBy(loop.definition.notes, delta))
    return true;
  useLayerStore
    .getState()
    .shiftLoopNotesOctave(editor.selectedLayerId, editor.selectedLoopId, delta);
  return true;
}

function adjustCompositionOctave(delta: 1 | -1): void {
  const { key, octave, setOctave } = useCompositionStore.getState();
  const { min, max } = loopOctaveBoundsForKey(key);
  const next = Math.max(min, Math.min(max, octave + delta));
  setOctave(next);
}

function armAddInstancePlacement(): boolean {
  const editor = useLayerEditorStore.getState();
  if (editor.selectedLoopId == null || editor.instanceEditState) return true;
  editor.setPendingPlacement({
    layerId: editor.selectedLayerId,
    loopId: editor.selectedLoopId,
    instances: [{ startBeat: 0, repeatCount: null, endBeat: null }],
  });
  return true;
}

function selectInstanceByDirection(e: KeyboardEvent, direction: 1 | -1): boolean {
  const editor = useLayerEditorStore.getState();
  if (editor.selectedLoopId == null || editor.instanceEditState) return false;
  const loop =
    useLayerStore.getState().layers[editor.selectedLayerId]?.layerLoops[
      editor.selectedLoopId
    ];
  if (!loop || loop.loopInstances.length === 0) return true;
  const current =
    editor.selectedInstanceIds.length === 0
      ? null
      : editor.selectedInstanceIds[editor.selectedInstanceIds.length - 1];
  const target =
    current == null
      ? 0
      : (current + direction + loop.loopInstances.length) %
        loop.loopInstances.length;

  if (e.metaKey || e.ctrlKey) {
    editor.toggleAddInstanceSelection(
      editor.selectedLayerId,
      editor.selectedLoopId,
      target,
    );
    return true;
  }

  editor.selectInstance(editor.selectedLayerId, editor.selectedLoopId, target);

  if (e.altKey && target === loop.loopInstances.length - 1 && !isRepeatOff(loop.definition)) {
    const selectedInstance = loop.loopInstances[target];
    useLayerStore.getState().setInstanceRepeatCount(
      editor.selectedLayerId,
      editor.selectedLoopId,
      target,
      selectedInstance.repeatCount === null ? Number.MAX_SAFE_INTEGER : null,
      getCompositionDims(),
    );
  }
  return true;
}

function selectEffectPage(pageIndex: number): boolean {
  const editor = useLayerEditorStore.getState();
  const page = getSelectedKnobPages()[pageIndex];
  const effect = page?.effects[0];
  if (!page || !effect) return true;
  editor.selectKnob(editor.selectedLayerId, editor.selectedLoopId, effect, page.kind);
  return true;
}

function cycleSelectedKnob(direction: 1 | -1): boolean {
  const editor = useLayerEditorStore.getState();
  if (!editor.selectedKnob) return false;
  const knobs = getSelectedKnobPages().flatMap((page) =>
    page.effects.map((effect) => ({ effect, kind: page.kind })),
  );
  if (knobs.length === 0) return true;
  const currentIndex = knobs.findIndex(
    (knob) =>
      knob.effect === editor.selectedKnob?.effect &&
      knob.kind === editor.selectedKnob?.kind,
  );
  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + direction + knobs.length) % knobs.length;
  const next = knobs[nextIndex];
  editor.selectKnob(
    editor.selectedLayerId,
    editor.selectedLoopId,
    next.effect,
    next.kind,
  );
  return true;
}

/**
 * App-wide key handling. Instance edit **actions** live in `hooks/instanceEditSession.ts`;
 * key routing for those actions is here alongside placement / copy / delete.
 */
export function handleGlobalKeyDown(e: KeyboardEvent): void {
  const isTextInput = isEditableTarget(e.target);

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
    if (e.key === "Escape") {
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

  if (isTextInput) return;

  const lowerKey = e.key.toLowerCase();

  const layerId = layerIdFromKeyEvent(e);
  if (layerId != null && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
    e.preventDefault();
    if (LAYER_IDS.includes(layerId)) es.setSelectedLayerId(layerId);
    return;
  }

  const requestedMode = modeFromKeyEvent(e, isTextInput);
  if (requestedMode != null) {
    e.preventDefault();
    tryBeginInstanceEdit(requestedMode);
    return;
  }

  if ((e.metaKey || e.ctrlKey) && e.key === "ArrowUp") {
    e.preventDefault();
    transposeSelectedLoop(1);
    return;
  }

  if ((e.metaKey || e.ctrlKey) && e.key === "ArrowDown") {
    e.preventDefault();
    transposeSelectedLoop(-1);
    return;
  }

  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    if (selectLoopByNumber(e.key)) {
      e.preventDefault();
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      if (!e.repeat) useTransportStore.getState().togglePlaying();
      return;
    }

    if (lowerKey === "z") {
      e.preventDefault();
      if (!e.repeat) removeCompositionMeasure();
      return;
    }

    if (lowerKey === "x") {
      e.preventDefault();
      if (!e.repeat) addCompositionMeasure();
      return;
    }

    if (lowerKey === "r") {
      e.preventDefault();
      if (!e.repeat) toggleLoopRecording();
      return;
    }

    if (lowerKey === "d") {
      e.preventDefault();
      if (!e.repeat) useLayerEditorStore.getState().togglePitchInputMode();
      return;
    }

    if (setViewFromKey(lowerKey)) {
      e.preventDefault();
      return;
    }

    if (e.key === ";") {
      e.preventDefault();
      useWorkspaceUiStore.getState().toggleEffectsOpen();
      return;
    }

    if (e.key === "'") {
      e.preventDefault();
      useWorkspaceUiStore.getState().togglePickerOpen();
      return;
    }

    if (lowerKey === "m") {
      e.preventDefault();
      useLayerPlaybackStore.getState().toggleManualMute(es.selectedLayerId);
      return;
    }

    if (lowerKey === "n") {
      e.preventDefault();
      useLayerPlaybackStore.getState().toggleLayerSolo(es.selectedLayerId);
      return;
    }

    const pageKeyIndex = ["y", "u", "i", "o", "p"].indexOf(lowerKey);
    if (pageKeyIndex !== -1) {
      e.preventDefault();
      selectEffectPage(pageKeyIndex);
      return;
    }
  }

  if (e.key === "ArrowUp" && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    adjustCompositionOctave(1);
    return;
  }

  if (e.key === "ArrowDown" && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    adjustCompositionOctave(-1);
    return;
  }

  if (e.key === "=" && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    armAddInstancePlacement();
    return;
  }

  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    if (selectInstanceByDirection(e, e.key === "ArrowRight" ? 1 : -1)) {
      e.preventDefault();
      return;
    }
  }

  if (e.key === "," || e.key === ".") {
    if (cycleSelectedKnob(e.key === "." ? 1 : -1)) {
      e.preventDefault();
      return;
    }
  }

  if (e.key === "Delete" || e.key === "Backspace") {
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
