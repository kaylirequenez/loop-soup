import type { LayerId, LayerLoopId } from "./layer";
import type { LoopDefinitionId, LoopInstanceId } from "./loop";

/**
 * What the editor is focused on within a layer (editor state only).
 * - `layerDefault`: edit `Layer.defaultMapping` only.
 * - `instance`: edit one placed instance (mapping, repeat, placement).
 * - `definition`: edit shared `LoopDefinition` (notes, span) for all instances with that id.
 */
export type LoopEditorFocus =
  | { kind: "layerDefault" }
  | { kind: "loop"; loopId: LayerLoopId }
  /** @deprecated Temporary compatibility while migrating selectors to loop ids. */
  | { kind: "instance"; loopInstanceId: LoopInstanceId }
  | { kind: "definition"; loopDefinitionId: LoopDefinitionId };

export interface LayerEditorState {
  selectedLayerId: LayerId;
  /** Per-layer editor focus; omitted key means "unspecified" (treat as layer default for that layer). */
  selectedLoopFocusByLayer: Partial<Record<LayerId, LoopEditorFocus>>;
}
