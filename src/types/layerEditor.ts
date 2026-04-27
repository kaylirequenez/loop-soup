import type { LayerId, LayerLoopId, LoopInstanceId } from "./layer";

export interface LayerEditorState {
  selectedLayerId: LayerId;
  selectedLoopId: LayerLoopId | null;
  /** Set only when a specific instance is selected; implies selectedLoopId is set. */
  selectedInstanceId: LoopInstanceId | null;
}
