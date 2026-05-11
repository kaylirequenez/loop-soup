import type { LayerId, LayerLoopId, LayerLoopInstance, LoopInstanceId } from "./layer";

export interface SelectedKnob {
  layerId: LayerId;
  loopId: LayerLoopId | null;
  effect: string;
  kind: "sound" | "mix";
}

export interface PendingPlacement {
  layerId: LayerId;
  loopId: LayerLoopId;
  /** Normalized instances: first.startBeat === 0. */
  instances: LayerLoopInstance[];
  /** Set when loopId was created by ArrowDown in placement mode; ArrowUp reverts to this loop. */
  originLoopId?: LayerLoopId;
}

/** Which edge/dimension Left/Right arrows currently adjust. */
export type InstanceEditMode = "shift" | "start" | "end";

export interface InstanceEditState {
  /** What Left/Right arrows currently adjust. null = mode key held but no delta yet applied. */
  activeMode: InstanceEditMode;
  /** Sorted ascending selected instance IDs being edited (cached from when session began). */
  sortedIds: LoopInstanceId[];
  /** Full instance array at session start — used to cancel and compute constraints. */
  originalInstances: LayerLoopInstance[];
  /** Snapshot of session-start instances excluding `sortedIds` (stable collision baseline). */
  originalInstancesSansSelection: LayerLoopInstance[];
  /** Running proposed state; passed verbatim to commitInstanceEdits on Enter. */
  proposedInstances: LayerLoopInstance[];
}

export interface LayerEditorState {
  /** Active layer being edited in controls/panels. */
  selectedLayerId: LayerId;
  /** Selected loop id inside `selectedLayerId`, or null when editing layer defaults. */
  selectedLoopId: LayerLoopId | null;
  /** Selected instances within selectedLoopId. Empty when no instance is selected. */
  selectedInstanceIds: LoopInstanceId[];
  /** True while the user is actively recording a new loop. */
  isRecordingLoop: boolean;
  /** Instances pending placement (copy-paste or add), following the cursor. */
  pendingPlacement: PendingPlacement | null;
  /** Active keyboard-driven instance edit session; non-null only while ≥1 instance is selected. */
  instanceEditState: InstanceEditState | null;
  /** Which knob page is currently visible on the layer card (0-indexed). */
  selectedKnobPage: number;
}
