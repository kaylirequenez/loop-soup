import type { LayerId, LayerLoopId } from "./layer";

export type MidiRollPlacement = "1" | "2" | "both";

/** MIDI phrase / roll focus uses layer loop id (shared definition + all instances). */
export type MidiNoteSelection = {
  layerId: LayerId;
  loopId: LayerLoopId;
} | null;

export type MidiLoopEditMode = {
  layerId: LayerId;
  loopId: LayerLoopId;
} | null;

/** Sparse per-loop map per layer. Missing loop keys default to `"both"` at read time. */
export type MidiLoopRollPlacementMap = Record<
  LayerId,
  Partial<Record<LayerLoopId, MidiRollPlacement>>
>;
