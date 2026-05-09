import type { LayerId, LayerLoopId, LoopInstanceId } from "../types/layer";

/**
 * Purpose:
 * Shared selection styling for composition timeline notes and MIDI roll notes.
 *
 * Behavior:
 * - No loop selected → empty string (full base color).
 * - Loop selected but not this loop → `mnote-layer-unselected` (dull).
 * - This loop selected, instance not matching → `mnote-layer-selected` (strong, no focus ring).
 * - This loop + instance selected → `cblock--instance-selected`.
 */
export function timelineNoteSelectionHighlightClasses(params: {
  selectedLoopId: LayerLoopId | null;
  selectedLayerId: LayerId;
  selectedInstanceIds: LoopInstanceId[];
  noteLayerId: LayerId;
  noteLoopIndex: number;
  noteInstanceIndex: number;
}): string {
  const {
    selectedLoopId,
    selectedLayerId,
    selectedInstanceIds,
    noteLayerId,
    noteLoopIndex,
    noteInstanceIndex,
  } = params;

  if (selectedLoopId == null) {
    return "";
  }

  const loopMatches =
    noteLayerId === selectedLayerId && noteLoopIndex === selectedLoopId;

  if (!loopMatches) {
    return "mnote-layer-unselected";
  }

  const instanceMatches = selectedInstanceIds.includes(noteInstanceIndex);

  return instanceMatches
    ? "cblock--instance-selected"
    : "mnote-layer-selected";
}
