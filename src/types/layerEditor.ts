import type { LayerId, LayerLoopId, LoopInstanceId } from "./layer";

export interface LayerEditorState {
  /** Active layer being edited in controls/panels. */
  selectedLayerId: LayerId;
  /** Selected loop id inside `selectedLayerId`, or null when editing layer defaults. */
  selectedLoopId: LayerLoopId | null;
  /** Set only when a specific instance is selected; implies selectedLoopId is set. */
  selectedInstanceId: LoopInstanceId | null;
  /** True while the user is actively recording a new loop. */
  isRecordingLoop: boolean;
}
