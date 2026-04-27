import type { LayerId, LayerLoopId } from "./layer";

export type RollSlot = 1 | 2;

export type MidiRollPlacement = "1" | "2" | "both";

/** Per-layer agreed placement, or null when loops have mixed placements. */
export type MidiLayerPlacement = Record<LayerId, MidiRollPlacement | null>;

/** Sparse per-loop map per layer. Missing loop keys default to `"both"` at read time. */
export type MidiLoopRollPlacementMap = Record<
  LayerId,
  Partial<Record<LayerLoopId, MidiRollPlacement>>
>;

export interface CombinedNoteEvent {
  layer: LayerId;
  loopIndex: number;
  LayerLoopId: LayerLoopId;
  noteIndex: number;
  storedOctave: number;
  noteKey: string;
  instanceOffset: number;
  globalStart: number;
  globalEnd: number;
  rowIndex: number;
  pitchClass: number;
  beatIndex: number;
  startInBeat?: number;
  lengthInBeat?: number;
}
